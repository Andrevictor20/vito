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

// ServePublicPage renderiza a página web pública Material Design 3 (< 25 KB).
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

	type formattedSlot struct {
		ID         string
		DateStr    string
		TimeStr    string
		VotesCount int
	}

	var formattedSlots []formattedSlot
	for _, s := range details.Slots {
		formattedSlots = append(formattedSlots, formattedSlot{
			ID:         s.ID,
			DateStr:    s.StartAt.Format("02/01 (Mon)"),
			TimeStr:    fmt.Sprintf("%s – %s", s.StartAt.Format("15:04"), s.EndAt.Format("15:04")),
			VotesCount: s.VotesCount,
		})
	}

	data := struct {
		ID              string
		Title           string
		Description     string
		DurationMinutes int
		Mode            string
		Status          string
		Expired         bool
		Slots           []formattedSlot
	}{
		ID:              details.ID,
		Title:           details.Title,
		Description:     details.Description,
		DurationMinutes: details.DurationMinutes,
		Mode:            details.Mode,
		Status:          details.Status,
		Expired:         time.Now().UTC().After(details.ExpiresAt),
		Slots:           formattedSlots,
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
  <title>{{.Title}} — Vito Reuniões</title>
  <style>
    :root {
      --bg: #0B0D10;
      --surface: #14171C;
      --surface-variant: #1E232B;
      --primary: #38BDF8;
      --primary-on: #082F49;
      --text: #F1F5F9;
      --text-muted: #94A3B8;
      --border: rgba(255, 255, 255, 0.08);
      --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #F8FAFC;
        --surface: #FFFFFF;
        --surface-variant: #F1F5F9;
        --primary: #0284C7;
        --primary-on: #FFFFFF;
        --text: #0F172A;
        --text-muted: #64748B;
        --border: rgba(0, 0, 0, 0.08);
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-family);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 16px;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      width: 100%;
      max-width: 480px;
      padding: 28px 24px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
    }
    .badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 4px 10px;
      border-radius: 12px;
      background: var(--surface-variant);
      color: var(--primary);
      margin-bottom: 12px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      line-height: 1.3;
      margin-bottom: 8px;
    }
    p.desc {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .slot-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 24px;
    }
    .slot-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      background: var(--surface-variant);
      border: 1px solid var(--border);
      border-radius: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-variant-numeric: tabular-nums;
    }
    .slot-item:hover {
      border-color: var(--primary);
    }
    .slot-item.selected {
      border-color: var(--primary);
      background: rgba(56, 189, 248, 0.1);
    }
    .slot-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .slot-date {
      font-size: 12px;
      color: var(--text-muted);
      font-weight: 600;
    }
    .slot-time {
      font-size: 15px;
      font-weight: 700;
      color: var(--text);
    }
    .vote-pill {
      font-size: 11px;
      background: var(--surface);
      padding: 3px 8px;
      border-radius: 10px;
      color: var(--text-muted);
      font-weight: 600;
    }
    .form-group {
      margin-bottom: 16px;
    }
    label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    input[type="text"] {
      width: 100%;
      padding: 12px 14px;
      border-radius: 12px;
      background: var(--surface-variant);
      border: 1px solid var(--border);
      color: var(--text);
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    input[type="text"]:focus {
      border-color: var(--primary);
    }
    button.btn-primary {
      width: 100%;
      padding: 14px;
      border-radius: 14px;
      background: var(--primary);
      color: var(--primary-on);
      font-size: 15px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    button.btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .success-box {
      display: none;
      text-align: center;
      padding: 20px 0;
    }
    .success-icon {
      font-size: 44px;
      margin-bottom: 12px;
    }
    .footer {
      text-align: center;
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 24px;
    }
  </style>
</head>
<body>
  <div class="card" id="mainCard">
    {{if .Expired}}
      <div class="badge" style="color: #EF4444;">Link Expirado</div>
      <h1>Esta reunião expirou</h1>
      <p class="desc">O prazo para votar ou confirmar horários desta reunião já foi encerrado.</p>
    {{else if eq .Status "confirmed"}}
      <div class="badge" style="color: #10B981;">Confirmada</div>
      <h1>{{.Title}}</h1>
      <p class="desc">Esta reunião já foi confirmada e inserida na agenda.</p>
    {{else}}
      <div class="badge">
        {{if eq .Mode "one_on_one"}}Link Mágico • 1-on-1{{else}}Consenso de Grupo{{end}}
      </div>
      <h1>{{.Title}}</h1>
      {{if .Description}}<p class="desc">{{.Description}}</p>{{end}}

      <p style="font-size: 13px; font-weight: 600; margin-bottom: 10px; color: var(--text-muted);">
        {{if eq .Mode "one_on_one"}}Selecione o melhor horário:{{else}}Vote nos horários que funcionam pra você:{{end}}
      </p>

      <div class="slot-list" id="slotList">
        {{range .Slots}}
          <div class="slot-item" data-slot-id="{{.ID}}" onclick="toggleSlot('{{.ID}}')">
            <div class="slot-info">
              <span class="slot-date">{{.DateStr}}</span>
              <span class="slot-time">{{.TimeStr}}</span>
            </div>
            {{if gt .VotesCount 0}}
              <span class="vote-pill">{{.VotesCount}} voto(s)</span>
            {{end}}
          </div>
        {{end}}
      </div>

      <div class="form-group">
        <label for="pName">Seu Nome *</label>
        <input type="text" id="pName" placeholder="Ex: Ana Silva" required>
      </div>

      <div class="form-group">
        <label for="pContact">WhatsApp ou E-mail (opcional)</label>
        <input type="text" id="pContact" placeholder="Ex: (11) 99999-9999 ou ana@email.com">
      </div>

      <button class="btn-primary" id="btnSubmit" onclick="submitVote()">
        {{if eq .Mode "one_on_one"}}Confirmar Reunião{{else}}Enviar Votos{{end}}
      </button>

      <div class="footer">Organizado com inteligência pelo Vito</div>
    {{end}}
  </div>

  <div class="card success-box" id="successCard">
    <div class="success-icon">✨</div>
    <h1 id="successTitle">Horário Confirmado!</h1>
    <p class="desc" id="successDesc">A reunião foi agendada com sucesso. Você receberá a confirmação e o evento já foi sincronizado.</p>
    <div class="footer">Vito Assistente Executivo</div>
  </div>

  <script>
    const isOneOnOne = "{{.Mode}}" === "one_on_one";
    let selectedSlots = new Set();

    function toggleSlot(id) {
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
      btn.innerText = 'Processando...';

      try {
        const res = await fetch('/api/public/meet/{{.ID}}/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participant_name: name,
            contact_info: contact,
            slot_ids: Array.from(selectedSlots)
          })
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || 'Falha ao processar voto.');
        }

        const data = await res.json();
        document.getElementById('mainCard').style.display = 'none';
        document.getElementById('successCard').style.display = 'block';

        if (isOneOnOne) {
          document.getElementById('successTitle').innerText = 'Reunião Confirmada!';
          document.getElementById('successDesc').innerText = 'Seu horário foi agendado na agenda do anfitrião com sucesso.';
        } else {
          document.getElementById('successTitle').innerText = 'Votos Registrados!';
          document.getElementById('successDesc').innerText = 'Seus horários preferidos foram gravados. Quando o grupo fechar, o evento será finalizado.';
        }
      } catch (e) {
        alert(e.message);
        btn.disabled = false;
        btn.innerText = isOneOnOne ? 'Confirmar Reunião' : 'Enviar Votos';
      }
    }
  </script>
</body>
</html>
`
