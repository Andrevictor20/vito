package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

// MeetingHandler gerencia rotas públicas e autenticadas do módulo de reuniões.
type MeetingHandler struct {
	meetingSvc *service.MeetingService
	pageTmpl   *template.Template
}

// NewMeetingHandler cria uma nova instância de MeetingHandler e compila o template público.
func NewMeetingHandler(meetingSvc *service.MeetingService) *MeetingHandler {
	tmpl := template.Must(template.New("meeting_page").Parse(meetingPageHTMLTemplate))
	return &MeetingHandler{
		meetingSvc: meetingSvc,
		pageTmpl:   tmpl,
	}
}

func brtZone() *time.Location {
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		return time.FixedZone("BRT", -3*3600)
	}
	return loc
}

var ptWeekdays = map[time.Weekday]string{
	time.Sunday:    "Dom",
	time.Monday:    "Seg",
	time.Tuesday:   "Ter",
	time.Wednesday: "Qua",
	time.Thursday:  "Qui",
	time.Friday:    "Sex",
	time.Saturday:  "Sáb",
}

func formatSlotDatePTBR(t time.Time) string {
	wd := ptWeekdays[t.Weekday()]
	return fmt.Sprintf("%s (%s)", t.Format("02/01"), wd)
}

// ServePublicPage renderiza a página web pública Editorial Minimalista (< 25 KB).
func (h *MeetingHandler) ServePublicPage(w http.ResponseWriter, r *http.Request) {
	meetingID := chi.URLParam(r, "id")
	details, err := h.meetingSvc.GetMeetingDetails(r.Context(), meetingID)
	if err != nil {
		if errors.Is(err, domain.ErrMeetingNotFound) {
			http.Error(w, "Reunião não encontrada ou link inativo", http.StatusNotFound)
			return
		}
		http.Error(w, "Erro ao carregar reunião", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self';")

	loc := brtZone()

	type formattedSlot struct {
		ID          string
		DateStr     string
		TimeStr     string
		VotesCount  int
		VoterNames  []string
		Percentage  int
		IsWinner    bool
		IsConfirmed bool
	}

	var formattedSlots []formattedSlot
	var confirmedSlotSummary string
	totalParticipants := len(details.Participants)

	for _, s := range details.Slots {
		localStart := s.StartAt.In(loc)
		localEnd := s.EndAt.In(loc)
		dateStr := formatSlotDatePTBR(localStart)
		timeStr := fmt.Sprintf("%s – %s", localStart.Format("15:04"), localEnd.Format("15:04"))
		isConf := details.ConfirmedSlotID != nil && *details.ConfirmedSlotID == s.ID
		if isConf {
			confirmedSlotSummary = fmt.Sprintf("%s • %s", dateStr, timeStr)
		}

		pct := 0
		if totalParticipants > 0 {
			pct = (s.VotesCount * 100) / totalParticipants
		}

		formattedSlots = append(formattedSlots, formattedSlot{
			ID:          s.ID,
			DateStr:     dateStr,
			TimeStr:     timeStr,
			VotesCount:  s.VotesCount,
			VoterNames:  s.VoterNames,
			Percentage:  pct,
			IsWinner:    s.IsWinner,
			IsConfirmed: isConf,
		})
	}

	data := struct {
		ID                   string
		Title                string
		Description          string
		DurationMinutes      int
		Mode                 string
		Status               string
		Expired              bool
		TotalParticipants    int
		ConfirmedSlotSummary string
		Slots                []formattedSlot
	}{
		ID:                   details.ID,
		Title:                details.Title,
		Description:          details.Description,
		DurationMinutes:      details.DurationMinutes,
		Mode:                 details.Mode,
		Status:               details.Status,
		Expired:              time.Now().UTC().After(details.ExpiresAt),
		TotalParticipants:    len(details.Participants),
		ConfirmedSlotSummary: confirmedSlotSummary,
		Slots:                formattedSlots,
	}

	_ = h.pageTmpl.Execute(w, data)
}

// GetPublicMeeting retorna os dados da reunião para consumo web público.
func (h *MeetingHandler) GetPublicMeeting(w http.ResponseWriter, r *http.Request) {
	meetingID := chi.URLParam(r, "id")
	details, err := h.meetingSvc.GetMeetingDetails(r.Context(), meetingID)
	if err != nil {
		respondError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(details)
}

// SubmitPublicVote processa o voto de um participante via requisição pública.
func (h *MeetingHandler) SubmitPublicVote(w http.ResponseWriter, r *http.Request) {
	meetingID := chi.URLParam(r, "id")

	var req service.SubmitVoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, domain.ErrInvalidMeetingData)
		return
	}
	req.MeetingID = meetingID

	res, err := h.meetingSvc.SubmitVote(r.Context(), req)
	if err != nil {
		respondError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

// CreateMeeting cria uma nova reunião para o usuário autenticado.
func (h *MeetingHandler) CreateMeeting(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "Não autorizado", http.StatusUnauthorized)
		return
	}

	var req service.CreateMeetingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, domain.ErrInvalidMeetingData)
		return
	}
	req.UserID = userID

	details, err := h.meetingSvc.CreateMeeting(r.Context(), req)
	if err != nil {
		respondError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(details)
}

// UpdateMeeting edita uma reunião existente para o usuário autenticado.
func (h *MeetingHandler) UpdateMeeting(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "Não autorizado", http.StatusUnauthorized)
		return
	}

	meetingID := chi.URLParam(r, "id")
	var req service.UpdateMeetingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, domain.ErrInvalidMeetingData)
		return
	}

	details, err := h.meetingSvc.UpdateMeeting(r.Context(), userID, meetingID, req)
	if err != nil {
		respondError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(details)
}

// ListMeetings lista as reuniões do usuário autenticado.
func (h *MeetingHandler) ListMeetings(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "Não autorizado", http.StatusUnauthorized)
		return
	}

	status := r.URL.Query().Get("status")
	list, err := h.meetingSvc.ListUserMeetings(r.Context(), userID, status)
	if err != nil {
		respondError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(list)
}

// GetMeeting busca detalhes completos de uma reunião do usuário autenticado.
func (h *MeetingHandler) GetMeeting(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "Não autorizado", http.StatusUnauthorized)
		return
	}

	meetingID := chi.URLParam(r, "id")
	details, err := h.meetingSvc.GetMeetingDetails(r.Context(), meetingID)
	if err != nil {
		respondError(w, err)
		return
	}

	if details.UserID != userID {
		respondError(w, domain.ErrMeetingNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(details)
}

// DeleteMeeting remove uma reunião do usuário autenticado.
func (h *MeetingHandler) DeleteMeeting(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "Não autorizado", http.StatusUnauthorized)
		return
	}

	meetingID := chi.URLParam(r, "id")
	if err := h.meetingSvc.DeleteMeeting(r.Context(), userID, meetingID); err != nil {
		respondError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ConfirmConsensus permite ao anfitrião confirmar manualmente um slot em reunião de grupo.
func (h *MeetingHandler) ConfirmConsensus(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "Não autorizado", http.StatusUnauthorized)
		return
	}

	meetingID := chi.URLParam(r, "id")
	var body struct {
		SlotID string `json:"slot_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.SlotID == "" {
		respondError(w, domain.ErrInvalidMeetingData)
		return
	}

	if err := h.meetingSvc.ConfirmConsensusSlot(r.Context(), userID, meetingID, body.SlotID); err != nil {
		respondError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "confirmed"})
}

// GetWhatsAppShare retorna a mensagem formatada para WhatsApp.
func (h *MeetingHandler) GetWhatsAppShare(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "Não autorizado", http.StatusUnauthorized)
		return
	}

	meetingID := chi.URLParam(r, "id")
	share, err := h.meetingSvc.GenerateWhatsAppShare(r.Context(), userID, meetingID)
	if err != nil {
		respondError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(share)
}

const meetingPageHTMLTemplate = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>{{.Title}} · Vito Reuniões</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0B0D10;
      --surface: #14171C;
      --surface-high: #1C2026;
      --surface-higher: #222730;
      --primary: #FAFAFA;
      --on-primary: #09090B;
      --text: #FAFAFA;
      --text-subtle: #A1A1AA;
      --text-muted: #71717A;
      --border: #262B33;
      --border-focus: #404856;
      --accent: #34D399;
      --accent-bg: rgba(52, 211, 153, 0.12);
      --accent-border: rgba(52, 211, 153, 0.32);
      --error: #F87171;
      --radius-card: 20px;
      --radius-slot: 14px;
      --radius-pill: 9999px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body {
      background-color: var(--bg);
      color: var(--text);
      display: flex;
      justify-content: center;
      min-height: 100vh;
      padding: 24px 16px;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      width: 100%;
      max-width: 540px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .brand-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 2px 4px;
    }
    .brand-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 800;
      color: var(--text);
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .brand-badge svg {
      color: var(--accent);
    }
    .live-status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      background: rgba(52, 211, 153, 0.1);
      border: 1px solid var(--accent-border);
      font-size: 10px;
      font-weight: 800;
      color: var(--accent);
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .live-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 8px var(--accent);
      animation: pulse 2s infinite ease-in-out;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      padding: 24px;
      box-shadow: 0 16px 40px -10px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }
    .header-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 5px 12px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--border);
      border-radius: var(--radius-pill);
      font-size: 11px;
      font-weight: 700;
      color: var(--text);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 14px;
    }
    .header-badge .dot {
      width: 6px;
      height: 6px;
      border-radius: 3px;
      background: var(--accent);
    }
    h1 {
      font-size: 24px;
      line-height: 30px;
      font-weight: 800;
      letter-spacing: -0.4px;
      margin-bottom: 6px;
    }
    p.desc {
      font-size: 14px;
      color: var(--text-subtle);
      line-height: 1.5;
      margin-bottom: 14px;
    }
    .meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-subtle);
      border-top: 1px solid var(--border);
      padding-top: 14px;
      margin-bottom: 16px;
    }
    .meta-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 8px;
      border-radius: 6px;
      background: var(--surface-high);
      border: 1px solid var(--border);
      font-size: 11px;
      font-variant-numeric: tabular-nums;
    }
    .poll-summary-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      border-radius: 12px;
      background: var(--surface-high);
      border: 1px solid var(--border);
      margin-bottom: 16px;
      gap: 10px;
    }
    .poll-summary-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .poll-summary-icon {
      font-size: 18px;
    }
    .poll-summary-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--text);
    }
    .poll-summary-sub {
      font-size: 11px;
      color: var(--text-subtle);
      font-variant-numeric: tabular-nums;
    }
    .poll-status-tag {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
      background: var(--surface-higher);
      color: var(--text-subtle);
      border: 1px solid var(--border);
      white-space: nowrap;
    }
    .poll-status-tag.confirmed {
      background: var(--accent-bg);
      color: var(--accent);
      border-color: var(--accent-border);
    }
    .section-label {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-subtle);
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .slot-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 22px;
    }
    .slot-item {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 14px 16px;
      background: var(--surface-high);
      border: 1.5px solid var(--border);
      border-radius: var(--radius-slot);
      cursor: pointer;
      transition: all 0.15s ease;
      font-variant-numeric: tabular-nums;
      position: relative;
      overflow: hidden;
    }
    .slot-item:hover {
      border-color: var(--border-focus);
      background: var(--surface-higher);
    }
    .slot-item.selected {
      border-color: var(--primary);
      background: rgba(255, 255, 255, 0.08);
    }
    .slot-item.winner {
      border-color: var(--accent-border);
    }
    .slot-item.selected.winner {
      border-color: var(--primary);
    }
    .slot-progress-bg {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      background: rgba(52, 211, 153, 0.12);
      border-radius: var(--radius-slot);
      pointer-events: none;
      transition: width 0.4s ease;
      z-index: 1;
    }
    .slot-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      position: relative;
      z-index: 2;
    }
    .slot-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .check-circle {
      width: 22px;
      height: 22px;
      border-radius: 7px;
      border: 1.5px solid var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 800;
      color: transparent;
      transition: all 0.15s ease;
      flex-shrink: 0;
      background: var(--surface);
    }
    .slot-item.selected .check-circle {
      background: var(--primary);
      border-color: var(--primary);
      color: var(--on-primary);
    }
    .slot-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .slot-date {
      font-size: 12px;
      color: var(--text-subtle);
      font-weight: 600;
    }
    .slot-time {
      font-size: 16px;
      font-weight: 800;
      color: var(--text);
      letter-spacing: -0.2px;
    }
    .slot-badges {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .winner-pill {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 3px 8px;
      border-radius: var(--radius-pill);
      background: var(--accent-bg);
      color: var(--accent);
      border: 1px solid var(--accent-border);
    }
    .vote-pill {
      font-size: 11px;
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 3px 9px;
      border-radius: var(--radius-pill);
      color: var(--text);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .voters-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      padding-left: 34px;
      position: relative;
      z-index: 2;
    }
    .voters-label {
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 600;
    }
    .voters-chips-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .voter-chip {
      font-size: 11px;
      font-weight: 600;
      color: var(--text);
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 2px 8px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .form-group {
      margin-bottom: 14px;
    }
    label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-subtle);
      margin-bottom: 6px;
    }
    input[type="text"] {
      width: 100%;
      padding: 12px 14px;
      border-radius: 12px;
      background: var(--surface-high);
      border: 1px solid var(--border);
      color: var(--text);
      font-size: 14px;
      outline: none;
      transition: border-color 0.15s;
    }
    input[type="text"]::placeholder {
      color: var(--text-muted);
    }
    input[type="text"]:focus {
      border-color: var(--accent);
    }
    button.btn-primary {
      width: 100%;
      padding: 14px;
      border-radius: 12px;
      background: var(--primary);
      color: var(--on-primary);
      font-size: 15px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.1s;
      margin-top: 4px;
    }
    button.btn-primary:hover:not(:disabled) {
      opacity: 0.94;
    }
    button.btn-primary:active:not(:disabled) {
      transform: scale(0.99);
    }
    button.btn-primary:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .banner-confirmed {
      background: var(--accent-bg);
      border: 1px solid var(--accent-border);
      color: var(--accent);
      padding: 14px 16px;
      border-radius: 14px;
      margin-bottom: 18px;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.45;
    }
    .voted-cached-note {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border);
      color: var(--text-subtle);
      padding: 10px 14px;
      border-radius: 10px;
      margin-bottom: 14px;
      font-size: 12px;
      line-height: 1.4;
    }
    .btn-change-vote {
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.4);
      color: var(--primary);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-top: 8px;
      display: inline-block;
    }
    .btn-change-vote:hover {
      background: var(--primary);
      color: #0c1017;
    }
    .powered {
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 6px;
    }
    .powered strong {
      color: var(--text-subtle);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand-bar">
      <div class="brand-badge">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 10h16v3H4zM6 10V5h12v5M2 13h20v2H2zM8 17l4 4 4-4"/>
        </svg>
        <span>VITO REUNIÕES</span>
      </div>
      <div class="live-status-pill">
        <span class="live-dot"></span>
        <span>AO VIVO</span>
      </div>
    </div>

    <div class="card" id="mainCard">
      {{if .Expired}}
        <div class="header-badge"><span class="dot" style="background: var(--error);"></span>Link Expirado</div>
        <h1>Esta reunião expirou</h1>
        <p class="desc">O prazo para votar ou confirmar horários desta reunião já foi encerrado.</p>
      {{else}}
        <div class="header-badge">
          <span class="dot"></span>
          {{if eq .Status "confirmed"}}Reunião Confirmada{{else if eq .Mode "one_on_one"}}Vito Booking · 1-on-1{{else}}Votação de Grupo · Consenso{{end}}
        </div>
        <h1>{{.Title}}</h1>
        {{if .Description}}<p class="desc">{{.Description}}</p>{{end}}

        <div class="meta-row">
          <span class="meta-pill">⏱ {{.DurationMinutes}} min</span>
          <span class="meta-pill">🌎 Horário de Brasília (BRT)</span>
          <span class="meta-pill" id="participantsCountBadge">👥 {{.TotalParticipants}} participante(s)</span>
        </div>

        <div class="poll-summary-box">
          <div class="poll-summary-left">
            <div class="poll-summary-icon">📊</div>
            <div class="poll-summary-text">
              <div class="poll-summary-title">Placar da Votação</div>
              <div class="poll-summary-sub"><span id="summaryVoterCount">{{.TotalParticipants}}</span> participante(s) já registraram votos</div>
            </div>
          </div>
          <div class="poll-status-tag {{if eq .Status "confirmed"}}confirmed{{end}}" id="pollStatusTag">
            {{if eq .Status "confirmed"}}✓ Confirmada{{else}}● Em Votação{{end}}
          </div>
        </div>

        <div id="votedCachedBanner" class="voted-cached-note" style="display: none;"></div>
        <div id="voteSuccessBanner" class="banner-confirmed" style="display: none;"></div>

        {{if eq .Status "confirmed"}}
          <div class="banner-confirmed">
            ✓ Horário definitivo confirmado{{if .ConfirmedSlotSummary}}: <strong>{{.ConfirmedSlotSummary}}</strong>{{end}}
          </div>
        {{end}}

        <div class="section-label">
          <span id="instructionLabel">
            {{if eq .Status "confirmed"}}Resultado final da votação:{{else if eq .Mode "one_on_one"}}Selecione o melhor horário:{{else}}Toque nos horários que funcionam para você:{{end}}
          </span>
        </div>

        <div class="slot-list" id="slotList">
          {{range .Slots}}
            <div class="slot-item {{if .IsWinner}}winner{{end}} {{if .IsConfirmed}}selected{{end}}" data-slot-id="{{.ID}}" onclick="toggleSlot('{{.ID}}')">
              <div class="slot-progress-bg" data-progress-fill="{{.ID}}" style="width: {{.Percentage}}%;"></div>
              <div class="slot-top">
                <div class="slot-left">
                  <div class="check-circle">✓</div>
                  <div class="slot-info">
                    <span class="slot-date">{{.DateStr}}</span>
                    <span class="slot-time">{{.TimeStr}}</span>
                  </div>
                </div>
                <div class="slot-badges">
                  {{if .IsConfirmed}}
                    <span class="winner-pill">✓ Confirmado</span>
                  {{else if .IsWinner}}
                    <span class="winner-pill">★ Mais votado</span>
                  {{end}}
                  <span class="vote-pill" data-vote-count="{{.ID}}">
                    <strong data-count-num="{{.ID}}">{{.VotesCount}}</strong> <span data-count-label="{{.ID}}">{{if eq .VotesCount 1}}voto{{else}}votos{{end}}</span> (<span data-percent-num="{{.ID}}">{{.Percentage}}%</span>)
                  </span>
                </div>
              </div>
              <div class="voters-row" data-voters-for="{{.ID}}" {{if eq (len .VoterNames) 0}}style="display:none"{{end}}>
                <span class="voters-label">Votaram:</span>
                <div class="voters-chips-list" data-chips-list="{{.ID}}">
                  {{range .VoterNames}}
                    <span class="voter-chip">👤 {{.}}</span>
                  {{end}}
                </div>
              </div>
            </div>
          {{end}}
        </div>

        {{if ne .Status "confirmed"}}
        <div id="voterFormSection">
          <div class="form-group">
            <label for="pName">Seu Nome *</label>
            <input type="text" id="pName" placeholder="Ex: Ana Silva" required>
          </div>

          <div class="form-group">
            <label for="pContact">WhatsApp ou E-mail (opcional)</label>
            <input type="text" id="pContact" placeholder="Ex: (11) 99999-9999 ou ana@email.com">
          </div>

          <button class="btn-primary" id="btnSubmit" onclick="submitVote()">
            {{if eq .Mode "one_on_one"}}Confirmar Reunião{{else}}Registrar Meu Voto{{end}}
          </button>
        </div>
        {{end}}
      {{end}}
    </div>

    <div class="powered">Organizado pelo <strong>Vito</strong> · Inteligência Executiva</div>
  </div>

  <script>
    const isOneOnOne = "{{.Mode}}" === "one_on_one";
    let isConfirmed = "{{.Status}}" === "confirmed";
    let selectedSlots = new Set();
    const meetingId = "{{.ID}}";

    // Verifica se já votou anteriormente
    let myParticipantId = '';
    try {
      myParticipantId = localStorage.getItem('vito_part_id_' + meetingId) || '';
      const savedVoter = localStorage.getItem('vito_voter_' + meetingId);
      if (savedVoter) {
        showVotedBanner(savedVoter);
      }
    } catch (e) {}

    function showVotedBanner(name) {
      const cachedBanner = document.getElementById('votedCachedBanner');
      if (cachedBanner) {
        cachedBanner.style.display = 'block';
        cachedBanner.innerHTML = '<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">' +
          '<span>✓ Seu voto está registrado como <strong>' + name + '</strong>.</span>' +
          '<button type="button" class="btn-change-vote" onclick="enableVoteEditing()">✏️ Alterar meu voto</button>' +
          '</div>';
      }
      const nameInput = document.getElementById('pName');
      if (nameInput && !nameInput.value) {
        nameInput.value = name;
      }
    }

    function enableVoteEditing() {
      const btn = document.getElementById('btnSubmit');
      if (btn) {
        btn.innerText = 'Salvar Alteração do Voto';
        btn.disabled = false;
      }
      const formSec = document.getElementById('voterFormSection');
      if (formSec) {
        formSec.style.display = 'block';
      }
      const instr = document.getElementById('instructionLabel');
      if (instr) {
        instr.innerText = 'Toque nos horários para alterar suas opções:';
      }
      const slotListEl = document.getElementById('slotList');
      if (slotListEl) {
        slotListEl.scrollIntoView({ behavior: 'smooth' });
      }
    }

    function toggleSlot(id) {
      if (isConfirmed) return;
      if (isOneOnOne) {
        selectedSlots.clear();
        selectedSlots.add(id);
      } else {
        if (selectedSlots.has(id)) {
          selectedSlots.delete(id);
        } else {
          selectedSlots.add(id);
        }
      }
      updateUI();
    }

    function updateUI() {
      document.querySelectorAll('.slot-item').forEach(el => {
        const id = el.getAttribute('data-slot-id');
        if (selectedSlots.has(id)) {
          el.classList.add('selected');
        } else {
          el.classList.remove('selected');
        }
      });
    }

    async function refreshLivePoll() {
      try {
        const res = await fetch('/api/public/meet/' + meetingId);
        if (!res.ok) return;
        const details = await res.json();
        const totalParts = Array.isArray(details.participants) ? details.participants.length : 0;

        const partBadge = document.getElementById('participantsCountBadge');
        if (partBadge) {
          partBadge.innerText = '👥 ' + totalParts + ' participante(s)';
        }
        const sumCount = document.getElementById('summaryVoterCount');
        if (sumCount) {
          sumCount.innerText = totalParts;
        }

        if (details.status === 'confirmed' && !isConfirmed) {
          isConfirmed = true;
          const statusTag = document.getElementById('pollStatusTag');
          if (statusTag) {
            statusTag.className = 'poll-status-tag confirmed';
            statusTag.innerText = '✓ Confirmada';
          }
        }

        if (Array.isArray(details.slots)) {
          let maxVotes = 0;
          details.slots.forEach(s => {
            const vCount = s.votes_count || (Array.isArray(s.voter_names) ? s.voter_names.length : 0);
            if (vCount > maxVotes) maxVotes = vCount;
          });

          details.slots.forEach(s => {
            const vCount = s.votes_count || (Array.isArray(s.voter_names) ? s.voter_names.length : 0);
            const pct = totalParts > 0 ? Math.round((vCount * 100) / totalParts) : 0;

            // Atualiza barra de progresso
            const progEl = document.querySelector('[data-progress-fill="' + s.id + '"]');
            if (progEl) {
              progEl.style.width = pct + '%';
            }

            // Atualiza números e percentual
            const numEl = document.querySelector('[data-count-num="' + s.id + '"]');
            if (numEl) numEl.innerText = vCount;

            const lblEl = document.querySelector('[data-count-label="' + s.id + '"]');
            if (lblEl) lblEl.innerText = vCount === 1 ? 'voto' : 'votos';

            const pctEl = document.querySelector('[data-percent-num="' + s.id + '"]');
            if (pctEl) pctEl.innerText = pct + '%';

            // Atualiza chips de quem votou
            const votersRow = document.querySelector('[data-voters-for="' + s.id + '"]');
            const chipsList = document.querySelector('[data-chips-list="' + s.id + '"]');
            if (votersRow && chipsList) {
              const names = Array.isArray(s.voter_names) ? s.voter_names : [];
              if (names.length > 0) {
                votersRow.style.display = 'flex';
                chipsList.innerHTML = '';
                names.forEach(n => {
                  const chip = document.createElement('span');
                  chip.className = 'voter-chip';
                  chip.textContent = '👤 ' + n;
                  chipsList.appendChild(chip);
                });
              } else {
                votersRow.style.display = 'none';
              }
            }

            // Destaque de vencedor / líder
            const slotEl = document.querySelector('[data-slot-id="' + s.id + '"]');
            if (slotEl) {
              if (maxVotes > 0 && vCount === maxVotes) {
                slotEl.classList.add('winner');
              } else {
                slotEl.classList.remove('winner');
              }
            }
          });
        }
      } catch (err) {}
    }

    // Atualização contínua ao vivo a cada 3.5 segundos
    setInterval(refreshLivePoll, 3500);

    async function submitVote() {
      const name = document.getElementById('pName').value.trim();
      const contact = document.getElementById('pContact').value.trim();
      const btn = document.getElementById('btnSubmit');

      if (!name) {
        alert('Por favor, informe seu nome.');
        return;
      }
      if (selectedSlots.size === 0) {
        alert('Selecione ao menos um horário.');
        return;
      }

      btn.disabled = true;
      btn.innerText = 'Registrando...';

      try {
        const payload = {
          participant_name: name,
          contact_info: contact,
          slot_ids: Array.from(selectedSlots)
        };
        if (myParticipantId) {
          payload.participant_id = myParticipantId;
        }

        const res = await fetch('/api/public/meet/' + meetingId + '/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || err.error || 'Falha ao processar voto.');
        }

        const resData = await res.json().catch(() => ({}));
        if (resData.participant_id) {
          myParticipantId = resData.participant_id;
          try {
            localStorage.setItem('vito_part_id_' + meetingId, myParticipantId);
          } catch (e) {}
        }
        try {
          localStorage.setItem('vito_voter_' + meetingId, name);
        } catch (e) {}

        await refreshLivePoll();

        const banner = document.getElementById('voteSuccessBanner');
        if (banner) {
          banner.style.display = 'block';
          if (isOneOnOne) {
            isConfirmed = true;
            banner.innerHTML = '✓ <strong>Reunião Confirmada!</strong> Seu horário foi agendado e o anfitrião já foi notificado.';
            const formSec = document.getElementById('voterFormSection');
            if (formSec) formSec.style.display = 'none';
          } else {
            const isUpdate = Boolean(resData.is_vote_update);
            banner.innerHTML = '✓ <strong>' + (isUpdate ? 'Voto alterado com sucesso, ' : 'Voto registrado com sucesso, ') + name + '!</strong> Placar atualizado em tempo real.';
            btn.innerText = 'Voto Salvo ✓';
            showVotedBanner(name);
          }
        }
      } catch (e) {
        alert(e.message);
        btn.disabled = false;
        btn.innerText = isOneOnOne ? 'Confirmar Reunião' : 'Registrar Meu Voto';
      }
    }
  </script>
</body>
</html>
`

