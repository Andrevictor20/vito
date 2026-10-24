package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"strings"

	"github.com/andrevmp/vito/backend/internal/domain"
)

func buildEncodedMIMEMessage(to, subject, bodyText string) string {
	cleanSubject := strings.TrimSpace(subject)
	if cleanSubject == "" {
		cleanSubject = "(Sem assunto)"
	}
	encodedSubject := mime.QEncoding.Encode("utf-8", cleanSubject)
	rawEmail := fmt.Sprintf(
		"To: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		strings.TrimSpace(to),
		encodedSubject,
		bodyText,
	)
	return base64.URLEncoding.EncodeToString([]byte(rawEmail))
}

// CreateDraft cria um rascunho de e-mail na conta do Gmail do usuário.
func (s *GmailService) CreateDraft(ctx context.Context, userID, to, subject, bodyText string) (string, error) {
	accessToken, err := s.GetValidAccessToken(ctx, userID)
	if err != nil {
		return "", err
	}

	encodedRaw := buildEncodedMIMEMessage(to, subject, bodyText)
	payload := map[string]interface{}{
		"message": map[string]string{
			"raw": encodedRaw,
		},
	}
	reqBytes, _ := json.Marshal(payload)

	draftURL := fmt.Sprintf("%s/gmail/v1/users/me/drafts", s.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, draftURL, bytes.NewReader(reqBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", err
	}

	if resp.StatusCode == http.StatusUnauthorized {
		resp.Body.Close()
		refreshedToken, refErr := s.forceRefreshToken(ctx, userID)
		if refErr != nil {
			_ = s.repo.UpdateStatus(ctx, userID, domain.GmailStatusReauthRequired)
			return "", domain.ErrGmailAuthFailed
		}
		accessToken = refreshedToken
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, draftURL, bytes.NewReader(reqBytes))
		if err != nil {
			return "", err
		}
		req.Header.Set("Authorization", "Bearer "+accessToken)
		req.Header.Set("Content-Type", "application/json")
		resp, err = s.httpClient.Do(req)
		if err != nil {
			return "", err
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("falha ao criar rascunho (status %d): %s", resp.StatusCode, string(respBody))
	}

	var draftResp struct {
		ID string `json:"id"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&draftResp)
	return draftResp.ID, nil
}

// SendEmail envia um e-mail imediatamente pela conta do Gmail conectada do usuário.
func (s *GmailService) SendEmail(ctx context.Context, userID, to, subject, bodyText string) (string, error) {
	cleanTo := strings.TrimSpace(to)
	if cleanTo == "" || !strings.Contains(cleanTo, "@") {
		return "", errors.New("destinatário de e-mail inválido")
	}
	if strings.TrimSpace(bodyText) == "" {
		return "", errors.New("corpo do e-mail não pode ser vazio")
	}

	accessToken, err := s.GetValidAccessToken(ctx, userID)
	if err != nil {
		return "", err
	}

	encodedRaw := buildEncodedMIMEMessage(cleanTo, subject, bodyText)
	payload := map[string]string{
		"raw": encodedRaw,
	}
	reqBytes, _ := json.Marshal(payload)

	sendURL := fmt.Sprintf("%s/gmail/v1/users/me/messages/send", s.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, sendURL, bytes.NewReader(reqBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", err
	}

	if resp.StatusCode == http.StatusUnauthorized {
		resp.Body.Close()
		refreshedToken, refErr := s.forceRefreshToken(ctx, userID)
		if refErr != nil {
			_ = s.repo.UpdateStatus(ctx, userID, domain.GmailStatusReauthRequired)
			return "", domain.ErrGmailAuthFailed
		}
		accessToken = refreshedToken
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, sendURL, bytes.NewReader(reqBytes))
		if err != nil {
			return "", err
		}
		req.Header.Set("Authorization", "Bearer "+accessToken)
		req.Header.Set("Content-Type", "application/json")
		resp, err = s.httpClient.Do(req)
		if err != nil {
			return "", err
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		_ = s.repo.UpdateStatus(ctx, userID, domain.GmailStatusReauthRequired)
		return "", domain.ErrGmailAuthFailed
	}
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("falha ao enviar e-mail pelo Gmail (status %d): %s", resp.StatusCode, string(respBody))
	}

	var sendResp struct {
		ID string `json:"id"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&sendResp)
	return sendResp.ID, nil
}
