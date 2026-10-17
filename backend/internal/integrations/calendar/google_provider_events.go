package calendar

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// CreateEvent cria um novo evento na agenda do Google.
func (p *GoogleProvider) CreateEvent(ctx context.Context, credentials, calendarID string, event *domain.Event) (*SyncItem, error) {
	token := extractAccessToken(credentials)
	if calendarID == "" {
		calendarID = "primary"
	}

	calPath := url.PathEscape(calendarID)
	calPath = strings.ReplaceAll(calPath, "@", "%40")
	reqURL := fmt.Sprintf("%s/calendar/v3/calendars/%s/events", p.cfg.BaseURL, calPath)

	startAt := event.StartAt.UTC()
	endAt := event.EndAt.UTC()
	if endAt.Before(startAt) || endAt.Equal(startAt) {
		endAt = startAt.Add(time.Hour)
	}

	payload := map[string]interface{}{
		"summary":     event.Title,
		"description": event.Description,
		"location":    event.Location,
		"start": map[string]string{
			"dateTime": startAt.Format(time.RFC3339),
		},
		"end": map[string]string{
			"dateTime": endAt.Format(time.RFC3339),
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

	calPath := url.PathEscape(calendarID)
	calPath = strings.ReplaceAll(calPath, "@", "%40")
	reqURL := fmt.Sprintf("%s/calendar/v3/calendars/%s/events/%s", p.cfg.BaseURL, calPath, url.PathEscape(externalID))

	startAt := event.StartAt.UTC()
	endAt := event.EndAt.UTC()
	if endAt.Before(startAt) || endAt.Equal(startAt) {
		endAt = startAt.Add(time.Hour)
	}

	payload := map[string]interface{}{
		"summary":     event.Title,
		"description": event.Description,
		"location":    event.Location,
		"start": map[string]string{
			"dateTime": startAt.Format(time.RFC3339),
		},
		"end": map[string]string{
			"dateTime": endAt.Format(time.RFC3339),
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

	calPath := url.PathEscape(calendarID)
	calPath = strings.ReplaceAll(calPath, "@", "%40")
	reqURL := fmt.Sprintf("%s/calendar/v3/calendars/%s/events/%s", p.cfg.BaseURL, calPath, url.PathEscape(externalID))
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
	if resp.StatusCode == http.StatusUnauthorized {
		newCreds, refErr := p.RefreshToken(ctx, credentials)
		if refErr == nil && newCreds != "" {
			newToken := extractAccessToken(newCreds)
			retryReq, rErr := http.NewRequestWithContext(ctx, http.MethodDelete, reqURL, nil)
			if rErr == nil {
				retryReq.Header.Set("Authorization", "Bearer "+newToken)
				retryResp, doErr := p.cfg.HTTPClient.Do(retryReq)
				if doErr == nil {
					defer retryResp.Body.Close()
					if retryResp.StatusCode == http.StatusNoContent || retryResp.StatusCode == http.StatusNotFound || retryResp.StatusCode == http.StatusGone || retryResp.StatusCode == http.StatusOK {
						return nil
					}
				}
			}
		}
	}
	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("falha ao deletar evento no Google (status %d): %s", resp.StatusCode, string(respBody))
	}
	return nil
}
