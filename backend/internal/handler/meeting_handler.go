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

