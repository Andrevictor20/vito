package calendar

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// GoogleConfig encapsula as configurações de cliente para a Google Calendar API v3.
type GoogleConfig struct {
	BaseURL      string
	AuthURL      string
	ClientID     string
	ClientSecret string
	RedirectURI  string
	HTTPClient   *http.Client
}

// GoogleProvider implementa a interface Provider para a Google Calendar API v3.
type GoogleProvider struct {
	cfg GoogleConfig
}

// NewGoogleProvider instancia um provedor Google Calendar com fallbacks seguros.
func NewGoogleProvider(cfg GoogleConfig) *GoogleProvider {
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://www.googleapis.com"
	}
	if cfg.AuthURL == "" {
		cfg.AuthURL = "https://oauth2.googleapis.com/token"
	}
	if cfg.HTTPClient == nil {
		cfg.HTTPClient = &http.Client{Timeout: 30 * time.Second}
	}
	return &GoogleProvider{cfg: cfg}
}

func (p *GoogleProvider) Name() string {
	return domain.ProviderGoogle
}

func extractAccessToken(credentials string) string {
	if strings.HasPrefix(strings.TrimSpace(credentials), "{") {
		var tokenMap map[string]interface{}
		if err := json.Unmarshal([]byte(credentials), &tokenMap); err == nil {
			if at, ok := tokenMap["access_token"].(string); ok && at != "" {
				return at
			}
		}
	}
	return credentials
}

type calendarListItem struct {
	ID       string `json:"id"`
	Summary  string `json:"summary"`
	Primary  bool   `json:"primary"`
	Selected bool   `json:"selected"`
}

type calendarListResponse struct {
	Items []calendarListItem `json:"items"`
}

func (p *GoogleProvider) getCalendarsToSync(ctx context.Context, token, defaultCalID string) []string {
	reqURL := fmt.Sprintf("%s/calendar/v3/users/me/calendarList", p.cfg.BaseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return []string{defaultCalID}
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")

	resp, err := p.cfg.HTTPClient.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		if resp != nil {
			resp.Body.Close()
		}
		return []string{defaultCalID}
	}
	defer resp.Body.Close()

	var clResp calendarListResponse
	if err := json.NewDecoder(resp.Body).Decode(&clResp); err != nil {
		return []string{defaultCalID}
	}

	var calIDs []string
	hasPrimary := false
	for _, item := range clResp.Items {
		if item.Primary || item.Selected {
			calIDs = append(calIDs, item.ID)
			if item.Primary || item.ID == "primary" {
				hasPrimary = true
			}
		}
	}

	if !hasPrimary && defaultCalID != "" {
		calIDs = append([]string{defaultCalID}, calIDs...)
	}
	if len(calIDs) == 0 {
		return []string{defaultCalID}
	}

	return calIDs
}

func (p *GoogleProvider) fetchEventsFromCalendar(ctx context.Context, token, calendarID, syncToken string, from, to time.Time) ([]SyncItem, string, bool, error) {
	var allItems []SyncItem
	var nextSyncToken string
	pageToken := ""

	for {
		reqURL := fmt.Sprintf("%s/calendar/v3/calendars/%s/events", p.cfg.BaseURL, url.PathEscape(calendarID))
		q := url.Values{}

		if syncToken != "" {
			q.Set("syncToken", syncToken)
		} else {
			q.Set("timeMin", from.UTC().Format(time.RFC3339))
			q.Set("timeMax", to.UTC().Format(time.RFC3339))
			q.Set("singleEvents", "true")
		}
		if pageToken != "" {
			q.Set("pageToken", pageToken)
		}
		reqURL += "?" + q.Encode()

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
		if err != nil {
			return nil, "", false, fmt.Errorf("falha ao criar requisição Google Calendar: %w", err)
		}
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Accept", "application/json")

		resp, err := p.cfg.HTTPClient.Do(req)
		if err != nil {
			return nil, "", false, fmt.Errorf("erro de rede com a Google Calendar API: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusGone {
			return nil, "", true, nil
		}

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			return nil, "", false, fmt.Errorf("Google Calendar API retornou status %d: %s", resp.StatusCode, string(body))
		}

		var gResp struct {
			NextPageToken string `json:"nextPageToken"`
			NextSyncToken string `json:"nextSyncToken"`
			Items         []struct {
				ID          string `json:"id"`
				ETag        string `json:"etag"`
				Summary     string `json:"summary"`
				Description string `json:"description"`
				Location    string `json:"location"`
				Status      string `json:"status"`
				Start       struct {
					DateTime string `json:"dateTime"`
					Date     string `json:"date"`
				} `json:"start"`
				End struct {
					DateTime string `json:"dateTime"`
					Date     string `json:"date"`
				} `json:"end"`
			} `json:"items"`
		}

		if err := json.NewDecoder(resp.Body).Decode(&gResp); err != nil {
			return nil, "", false, fmt.Errorf("falha ao decodificar resposta JSON do Google: %w", err)
		}

		for _, item := range gResp.Items {
			var startAt, endAt time.Time
			isAllDay := false

			if item.Start.DateTime != "" {
				startAt, _ = time.Parse(time.RFC3339, item.Start.DateTime)
			} else if item.Start.Date != "" {
				startAt, _ = time.Parse("2006-01-02", item.Start.Date)
				isAllDay = true
			}

			if item.End.DateTime != "" {
				endAt, _ = time.Parse(time.RFC3339, item.End.DateTime)
			} else if item.End.Date != "" {
				endAt, _ = time.Parse("2006-01-02", item.End.Date)
			}

			status := strings.ToLower(item.Status)
			if status == "" {
				status = "confirmed"
			}

			allItems = append(allItems, SyncItem{
				ExternalID:  item.ID,
				ETag:        item.ETag,
				Title:       item.Summary,
				Description: item.Description,
				Location:    item.Location,
				StartAt:     startAt,
				EndAt:       endAt,
				Status:      status,
				IsAllDay:    isAllDay,
			})
		}

		nextSyncToken = gResp.NextSyncToken
		if gResp.NextPageToken == "" {
			break
		}
		pageToken = gResp.NextPageToken
	}

	return allItems, nextSyncToken, false, nil
}

// FetchEvents obtém eventos da agenda (Full Sync ou Incremental via syncToken).
// Quando calendarID for primary, também sincroniza automaticamente calendários secundários selecionados pelo usuário.
func (p *GoogleProvider) FetchEvents(ctx context.Context, credentials, calendarID, syncToken string, from, to time.Time) (*SyncResult, error) {
	token := extractAccessToken(credentials)
	if calendarID == "" {
		calendarID = "primary"
	}

	calendars := []string{calendarID}
	if calendarID == "primary" {
		calendars = p.getCalendarsToSync(ctx, token, calendarID)
	}

	var totalItems []SyncItem
	primarySyncToken := ""
	seenIDs := make(map[string]bool)

	for _, calID := range calendars {
		calSyncToken := ""
		if calID == "primary" {
			calSyncToken = syncToken
		}
		items, newSync, fullSyncReq, err := p.fetchEventsFromCalendar(ctx, token, calID, calSyncToken, from, to)
		if err != nil {
			if calID == "primary" || calID == calendarID {
				return nil, err
			}
			continue
		}
		if fullSyncReq {
			return &SyncResult{FullSyncReq: true}, nil
		}
		if calID == "primary" || calID == calendarID {
			primarySyncToken = newSync
		}
		for _, it := range items {
			if !seenIDs[it.ExternalID] {
				seenIDs[it.ExternalID] = true
				totalItems = append(totalItems, it)
			}
		}
	}

	return &SyncResult{
		NewSyncToken: primarySyncToken,
		Items:        totalItems,
	}, nil
}

// CreateEvent cria um novo evento na agenda do Google.
func (p *GoogleProvider) CreateEvent(ctx context.Context, credentials, calendarID string, event *domain.Event) (*SyncItem, error) {
	token := extractAccessToken(credentials)
	if calendarID == "" {
		calendarID = "primary"
	}

	reqURL := fmt.Sprintf("%s/calendar/v3/calendars/%s/events", p.cfg.BaseURL, url.PathEscape(calendarID))

	payload := map[string]interface{}{
		"summary":     event.Title,
		"description": event.Description,
		"location":    event.Location,
		"start": map[string]string{
			"dateTime": event.StartAt.UTC().Format(time.RFC3339),
		},
		"end": map[string]string{
			"dateTime": event.EndAt.UTC().Format(time.RFC3339),
		},
	}

	bodyBytes, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.cfg.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Google Calendar falhou ao criar evento (status %d): %s", resp.StatusCode, string(respBody))
	}

	var res struct {
		ID      string `json:"id"`
		ETag    string `json:"etag"`
		Summary string `json:"summary"`
		Status  string `json:"status"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, err
	}

	return &SyncItem{
		ExternalID: res.ID,
		ETag:       res.ETag,
		Title:      res.Summary,
		Status:     res.Status,
		StartAt:    event.StartAt,
		EndAt:      event.EndAt,
	}, nil
}

// UpdateEvent atualiza um evento existente no Google Calendar.
func (p *GoogleProvider) UpdateEvent(ctx context.Context, credentials, calendarID, externalID string, event *domain.Event) (*SyncItem, error) {
	token := extractAccessToken(credentials)
	if calendarID == "" {
		calendarID = "primary"
	}

	reqURL := fmt.Sprintf("%s/calendar/v3/calendars/%s/events/%s", p.cfg.BaseURL, url.PathEscape(calendarID), url.PathEscape(externalID))

	payload := map[string]interface{}{
		"summary":     event.Title,
		"description": event.Description,
		"location":    event.Location,
		"start": map[string]string{
			"dateTime": event.StartAt.UTC().Format(time.RFC3339),
		},
		"end": map[string]string{
			"dateTime": event.EndAt.UTC().Format(time.RFC3339),
		},
	}

	bodyBytes, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, reqURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.cfg.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("falha ao atualizar evento no Google (status %d): %s", resp.StatusCode, string(respBody))
	}

	var res struct {
		ID      string `json:"id"`
		ETag    string `json:"etag"`
		Summary string `json:"summary"`
		Status  string `json:"status"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, err
	}

	return &SyncItem{
		ExternalID: res.ID,
		ETag:       res.ETag,
		Title:      res.Summary,
		Status:     res.Status,
		StartAt:    event.StartAt,
		EndAt:      event.EndAt,
	}, nil
}

// DeleteEvent exclui um evento da agenda remota.
func (p *GoogleProvider) DeleteEvent(ctx context.Context, credentials, calendarID, externalID string) error {
	token := extractAccessToken(credentials)
	if calendarID == "" {
		calendarID = "primary"
	}

	reqURL := fmt.Sprintf("%s/calendar/v3/calendars/%s/events/%s", p.cfg.BaseURL, url.PathEscape(calendarID), url.PathEscape(externalID))
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, reqURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := p.cfg.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// 204 No Content, ou 404/410 se já excluído
	if resp.StatusCode == http.StatusNoContent || resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone {
		return nil
	}
	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("falha ao deletar evento no Google (status %d): %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// RefreshToken renova um access_token expirado usando o refresh_token.
func (p *GoogleProvider) RefreshToken(ctx context.Context, credentials string) (string, error) {
	var credMap map[string]interface{}
	if err := json.Unmarshal([]byte(credentials), &credMap); err != nil {
		return "", errors.New("credenciais inválidas para refresh de token")
	}

	refreshToken, ok := credMap["refresh_token"].(string)
	if !ok || refreshToken == "" {
		return "", errors.New("refresh_token não presente nas credenciais")
	}

	data := url.Values{}
	data.Set("client_id", p.cfg.ClientID)
	data.Set("client_secret", p.cfg.ClientSecret)
	data.Set("refresh_token", refreshToken)
	data.Set("grant_type", "refresh_token")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.cfg.AuthURL, strings.NewReader(data.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := p.cfg.HTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("falha ao renovar token no Google (status %d): %s", resp.StatusCode, string(body))
	}

	var tokenResp map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", err
	}

	// Preserva o refresh_token se o Google não retornar um novo
	if _, ok := tokenResp["refresh_token"]; !ok {
		tokenResp["refresh_token"] = refreshToken
	}

	newBytes, err := json.Marshal(tokenResp)
	if err != nil {
		return "", err
	}

	return string(newBytes), nil
}
