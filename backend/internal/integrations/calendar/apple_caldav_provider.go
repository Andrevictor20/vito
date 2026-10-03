package calendar

import (
	"bytes"
	"context"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// AppleCalDAVConfig encapsula os parâmetros do cliente CalDAV para o iCloud.
type AppleCalDAVConfig struct {
	BaseURL    string
	HTTPClient *http.Client
}

// AppleCalDAVProvider implementa a interface Provider via protocolo CalDAV (RFC 4791).
type AppleCalDAVProvider struct {
	cfg AppleCalDAVConfig
}

// NewAppleCalDAVProvider instancia o provedor CalDAV da Apple com valores seguros.
func NewAppleCalDAVProvider(cfg AppleCalDAVConfig) *AppleCalDAVProvider {
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://caldav.icloud.com"
	}
	if cfg.HTTPClient == nil {
		cfg.HTTPClient = &http.Client{Timeout: 30 * time.Second}
	}
	return &AppleCalDAVProvider{cfg: cfg}
}

func (p *AppleCalDAVProvider) Name() string {
	return domain.ProviderAppleCalDAV
}

func parseCalDAVCreds(credentials string) (string, string, error) {
	if strings.HasPrefix(strings.TrimSpace(credentials), "{") {
		var credMap map[string]string
		if err := json.Unmarshal([]byte(credentials), &credMap); err == nil {
			return credMap["username"], credMap["password"], nil
		}
	}
	parts := strings.SplitN(credentials, ":", 2)
	if len(parts) == 2 {
		return parts[0], parts[1], nil
	}
	return "", "", errors.New("credenciais CalDAV inválidas (esperado JSON ou 'username:password')")
}

type multiStatusXML struct {
	XMLName   xml.Name      `xml:"multistatus"`
	Responses []responseXML `xml:"response"`
}

type responseXML struct {
	Href     string       `xml:"href"`
	PropStat propStatXML  `xml:"propstat"`
}

type propStatXML struct {
	Status string  `xml:"status"`
	Prop   propXML `xml:"prop"`
}

type propXML struct {
	GetETag      string `xml:"getetag"`
	CalendarData string `xml:"calendar-data"`
}

// FetchEvents consulta a coleção CalDAV da Apple usando o método REPORT com calendar-query.
func (p *AppleCalDAVProvider) FetchEvents(ctx context.Context, credentials, calendarID, syncToken string, from, to time.Time) (*SyncResult, error) {
	username, password, err := parseCalDAVCreds(credentials)
	if err != nil {
		return nil, err
	}

	startStr := from.UTC().Format("20060102T150405Z")
	endStr := to.UTC().Format("20060102T150405Z")

	reportXML := fmt.Sprintf(`<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="%s" end="%s"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`, startStr, endStr)

	endpoint := strings.TrimRight(p.cfg.BaseURL, "/")
	if calendarID != "" && !strings.HasPrefix(calendarID, "/") {
		endpoint += "/" + calendarID
	} else if calendarID != "" {
		endpoint += calendarID
	}

	req, err := http.NewRequestWithContext(ctx, "REPORT", endpoint, strings.NewReader(reportXML))
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(username, password)
	req.Header.Set("Content-Type", "application/xml; charset=utf-8")
	req.Header.Set("Depth", "1")

	resp, err := p.cfg.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("erro de conexão com CalDAV Apple: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 207 && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("CalDAV Apple retornou status %d: %s", resp.StatusCode, string(body))
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var ms multiStatusXML
	if err := xml.Unmarshal(bodyBytes, &ms); err != nil {
		return nil, fmt.Errorf("falha ao interpretar XML Multi-Status do CalDAV: %w", err)
	}

	result := &SyncResult{
		Items: make([]SyncItem, 0),
	}

	for _, r := range ms.Responses {
		if r.PropStat.Prop.CalendarData == "" {
			continue
		}

		parsed, err := ParseICalToSyncItems(r.PropStat.Prop.CalendarData)
		if err != nil {
			continue
		}

		for _, item := range parsed {
			if r.PropStat.Prop.GetETag != "" {
				item.ETag = r.PropStat.Prop.GetETag
			}
			result.Items = append(result.Items, item)
		}
	}

	return result, nil
}

// CreateEvent cria um novo evento na coleção CalDAV via HTTP PUT com payload iCalendar.
func (p *AppleCalDAVProvider) CreateEvent(ctx context.Context, credentials, calendarID string, event *domain.Event) (*SyncItem, error) {
	username, password, err := parseCalDAVCreds(credentials)
	if err != nil {
		return nil, err
	}

	uid := uuid.New().String()
	icalBody := FormatEventToICal(event, uid)

	endpoint := strings.TrimRight(p.cfg.BaseURL, "/")
	if calendarID != "" && !strings.HasPrefix(calendarID, "/") {
		endpoint += "/" + calendarID
	} else if calendarID != "" {
		endpoint += calendarID
	}
	endpoint = fmt.Sprintf("%s/%s.ics", endpoint, uid)

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, endpoint, bytes.NewBufferString(icalBody))
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(username, password)
	req.Header.Set("Content-Type", "text/calendar; charset=utf-8")

	resp, err := p.cfg.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("CalDAV falhou ao criar evento (status %d): %s", resp.StatusCode, string(body))
	}

	etag := resp.Header.Get("ETag")
	return &SyncItem{
		ExternalID:  uid,
		ETag:        etag,
		Title:       event.Title,
		Description: event.Description,
		Location:    event.Location,
		StartAt:     event.StartAt,
		EndAt:       event.EndAt,
		Status:      "confirmed",
	}, nil
}

// UpdateEvent atualiza um evento existente no servidor CalDAV.
func (p *AppleCalDAVProvider) UpdateEvent(ctx context.Context, credentials, calendarID, externalID string, event *domain.Event) (*SyncItem, error) {
	username, password, err := parseCalDAVCreds(credentials)
	if err != nil {
		return nil, err
	}

	icalBody := FormatEventToICal(event, externalID)

	endpoint := strings.TrimRight(p.cfg.BaseURL, "/")
	if calendarID != "" && !strings.HasPrefix(calendarID, "/") {
		endpoint += "/" + calendarID
	} else if calendarID != "" {
		endpoint += calendarID
	}
	endpoint = fmt.Sprintf("%s/%s.ics", endpoint, externalID)

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, endpoint, bytes.NewBufferString(icalBody))
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(username, password)
	req.Header.Set("Content-Type", "text/calendar; charset=utf-8")

	resp, err := p.cfg.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("CalDAV falhou ao atualizar evento (status %d): %s", resp.StatusCode, string(body))
	}

	etag := resp.Header.Get("ETag")
	return &SyncItem{
		ExternalID:  externalID,
		ETag:        etag,
		Title:       event.Title,
		Description: event.Description,
		Location:    event.Location,
		StartAt:     event.StartAt,
		EndAt:       event.EndAt,
		Status:      "confirmed",
	}, nil
}

// DeleteEvent remove um evento do servidor CalDAV.
func (p *AppleCalDAVProvider) DeleteEvent(ctx context.Context, credentials, calendarID, externalID string) error {
	username, password, err := parseCalDAVCreds(credentials)
	if err != nil {
		return err
	}

	endpoint := strings.TrimRight(p.cfg.BaseURL, "/")
	if calendarID != "" && !strings.HasPrefix(calendarID, "/") {
		endpoint += "/" + calendarID
	} else if calendarID != "" {
		endpoint += calendarID
	}
	endpoint = fmt.Sprintf("%s/%s.ics", endpoint, externalID)

	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, endpoint, nil)
	if err != nil {
		return err
	}
	req.SetBasicAuth(username, password)

	resp, err := p.cfg.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone || resp.StatusCode == http.StatusNoContent || resp.StatusCode == http.StatusOK {
		return nil
	}

	body, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("CalDAV falhou ao deletar evento (status %d): %s", resp.StatusCode, string(body))
}

// RefreshToken em CalDAV com App-Specific Password preserva as credenciais fornecidas.
func (p *AppleCalDAVProvider) RefreshToken(ctx context.Context, credentials string) (string, error) {
	_, _, err := parseCalDAVCreds(credentials)
	if err != nil {
		return "", err
	}
	return credentials, nil
}
