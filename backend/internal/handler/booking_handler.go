package handler

import (
	"encoding/json"
	"errors"
	"html/template"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

// BookingHandler manipula as requisições web públicas e REST autenticadas do Vito Booking.
type BookingHandler struct {
	bookingSvc *service.BookingService
	pageTmpl   *template.Template
}

// NewBookingHandler instancia o manipulador de booking e compila o template HTML M3 ultraleve.
func NewBookingHandler(bookingSvc *service.BookingService) *BookingHandler {
	tmpl := template.Must(template.New("booking_page").Parse(bookingPageHTMLTemplate))
	return &BookingHandler{
		bookingSvc: bookingSvc,
		pageTmpl:   tmpl,
	}
}

// ServePublicPage renderiza a página web pública Material Design 3 (< 25 KB).
func (h *BookingHandler) ServePublicPage(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")
	slug := chi.URLParam(r, "slug")

	bt, err := h.bookingSvc.GetBookingTypeBySlug(r.Context(), username, slug)
	if err != nil {
		http.Error(w, "Página de agendamento não encontrada ou link inativo", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://challenges.cloudflare.com;")

	data := struct {
		Title           string
		Description     string
		DurationMinutes int
		Username        string
		Slug            string
	}{
		Title:           bt.Title,
		Description:     bt.Description,
		DurationMinutes: bt.DurationMinutes,
		Username:        username,
		Slug:            slug,
	}

	_ = h.pageTmpl.Execute(w, data)
}

// GetPublicSlots retorna os horários disponíveis em formato JSON para a data requisitada.
func (h *BookingHandler) GetPublicSlots(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")
	slug := chi.URLParam(r, "slug")
	dateStr := r.URL.Query().Get("date")

	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		loc = time.FixedZone("BRT", -3*3600)
	}

	date := time.Now().In(loc)
	if dateStr != "" {
		if parsed, err := time.ParseInLocation("2006-01-02", dateStr, loc); err == nil {
			date = parsed
		}
	}

	slots, err := h.bookingSvc.GetAvailableSlots(r.Context(), username, slug, date)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(slots)
}

// ReservePublicSlot processa o agendamento público pelo convidado.
func (h *BookingHandler) ReservePublicSlot(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")
	slug := chi.URLParam(r, "slug")

	var req service.ReserveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Payload JSON inválido", http.StatusBadRequest)
		return
	}

	remoteIP := r.RemoteAddr
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		parts := strings.Split(forwarded, ",")
		remoteIP = strings.TrimSpace(parts[0])
	}

	appt, err := h.bookingSvc.ReserveAppointment(r.Context(), username, slug, req, remoteIP)
	if err != nil {
		if errors.Is(err, domain.ErrBookingConflict) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusConflict)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "O horário selecionado acabou de ser reservado ou conflita com outro compromisso.",
			})
			return
		}
		if errors.Is(err, domain.ErrTurnstileFailed) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "Falha na validação anti-bot.",
			})
			return
		}
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(appt)
}

// ListTypes retorna os tipos de agendamento configurados pelo usuário logado.
func (h *BookingHandler) ListTypes(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "Não autorizado", http.StatusUnauthorized)
		return
	}

	types, err := h.bookingSvc.ListBookingTypes(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if types == nil {
		types = []service.BookingTypeWithLink{}
	}
	_ = json.NewEncoder(w).Encode(types)
}

// CreateType cria um novo tipo de agendamento pelo usuário logado.
func (h *BookingHandler) CreateType(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "Não autorizado", http.StatusUnauthorized)
		return
	}

	var bt domain.BookingType
	if err := json.NewDecoder(r.Body).Decode(&bt); err != nil {
		http.Error(w, "Payload inválido", http.StatusBadRequest)
		return
	}

	created, err := h.bookingSvc.CreateBookingType(r.Context(), userID, &bt)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(created)
}

// UpdateType atualiza o tipo de agendamento existente.
func (h *BookingHandler) UpdateType(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "Não autorizado", http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	var bt domain.BookingType
	if err := json.NewDecoder(r.Body).Decode(&bt); err != nil {
		http.Error(w, "Payload inválido", http.StatusBadRequest)
		return
	}
	bt.ID = id

	updated, err := h.bookingSvc.UpdateBookingType(r.Context(), userID, &bt)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(updated)
}

// DeleteType remove o tipo de agendamento.
func (h *BookingHandler) DeleteType(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "Não autorizado", http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	if err := h.bookingSvc.DeleteBookingType(r.Context(), userID, id); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ListAppointments retorna o histórico de agendamentos recebidos pelo anfitrião.
func (h *BookingHandler) ListAppointments(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "Não autorizado", http.StatusUnauthorized)
		return
	}

	appts, err := h.bookingSvc.ListAppointments(r.Context(), userID, time.Time{}, time.Time{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if appts == nil {
		appts = []domain.BookingAppointment{}
	}
	_ = json.NewEncoder(w).Encode(appts)
}

// DeleteAppointment cancela o agendamento recebido e desocupa o horário na agenda do anfitrião.
func (h *BookingHandler) DeleteAppointment(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "Não autorizado", http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	if err := h.bookingSvc.CancelAppointment(r.Context(), userID, id); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// bookingPageHTMLTemplate é o HTML5/CSS3 Material Design 3 ultraleve (< 25 KB).
const bookingPageHTMLTemplate = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>{{.Title}} · Vito Booking</title>
  <style>
    :root {
      --primary: #006874;
      --on-primary: #ffffff;
      --bg: #f8fdff;
      --surface: #ffffff;
      --surface-container: #edf5f7;
      --text: #191c1d;
      --text-subtle: #4b6267;
      --border: #dbe4e6;
      --accent: #2e7d32;
      --error: #ba1a1a;
      --radius: 16px;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --primary: #4fd8eb;
        --on-primary: #00363d;
        --bg: #0e1415;
        --surface: #141c1e;
        --surface-container: #1c2628;
        --text: #e1e3e4;
        --text-subtle: #899294;
        --border: #2c383b;
        --accent: #81c784;
        --error: #ffb4ab;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: var(--bg); color: var(--text); display: flex; justify-content: center; min-height: 100vh; padding: 24px 16px; }
    .container { width: 100%; max-width: 580px; display: flex; flex-direction: column; gap: 20px; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
    .header-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: var(--surface-container); border-radius: 99px; font-size: 12px; font-weight: 600; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 6px; }
    .desc { font-size: 14px; color: var(--text-subtle); line-height: 1.5; margin-bottom: 16px; }
    .meta-row { display: flex; gap: 16px; font-size: 13px; font-weight: 500; color: var(--text-subtle); border-top: 1px solid var(--border); padding-top: 14px; }
    .meta-item { display: flex; align-items: center; gap: 6px; }
    .date-scroller { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; scrollbar-width: none; }
    .date-scroller::-webkit-scrollbar { display: none; }
    .date-btn { flex: 0 0 68px; height: 74px; border: 1px solid var(--border); background: var(--surface); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease; color: var(--text); }
    .date-btn.active { background: var(--primary); color: var(--on-primary); border-color: var(--primary); }
    .date-btn .weekday { font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 2px; }
    .date-btn .day { font-size: 20px; font-weight: 700; font-feature-settings: 'tnum'; }
    .slots-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px; margin-top: 14px; }
    .slot-btn { padding: 12px 8px; border: 1px solid var(--border); background: var(--surface); border-radius: 10px; font-size: 14px; font-weight: 600; color: var(--text); cursor: pointer; text-align: center; transition: all 0.15s ease; font-feature-settings: 'tnum'; }
    .slot-btn:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
    .slot-btn.selected { background: var(--primary); color: var(--on-primary); border-color: var(--primary); }
    .slot-btn:disabled { opacity: 0.35; cursor: not-allowed; text-decoration: line-through; }
    .form-group { margin-top: 16px; display: flex; flex-direction: column; gap: 6px; }
    label { font-size: 13px; font-weight: 600; color: var(--text); }
    input, textarea { width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 14px; outline: none; }
    input:focus, textarea:focus { border-color: var(--primary); }
    .btn-submit { width: 100%; padding: 14px; margin-top: 20px; border: none; border-radius: 12px; background: var(--primary); color: var(--on-primary); font-size: 15px; font-weight: 700; cursor: pointer; transition: opacity 0.15s ease; }
    .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
    .success-card { text-align: center; padding: 40px 20px; }
    .success-icon { width: 56px; height: 56px; border-radius: 28px; background: rgba(46, 125, 50, 0.15); color: var(--accent); display: inline-flex; align-items: center; justify-content: center; font-size: 28px; margin-bottom: 16px; }
    .powered { text-align: center; font-size: 12px; color: var(--text-subtle); margin-top: 12px; }
    .error-banner { background: rgba(186, 26, 26, 0.1); border: 1px solid var(--error); color: var(--error); padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-top: 12px; display: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card" id="bookingCard">
      <div class="header-badge">● Vito Booking</div>
      <h1>{{.Title}}</h1>
      {{if .Description}}<p class="desc">{{.Description}}</p>{{end}}
      <div class="meta-row">
        <div class="meta-item">⏱ {{.DurationMinutes}} min</div>
        <div class="meta-item">📅 Escolha uma data</div>
      </div>

      <div style="margin-top: 20px;">
        <div class="date-scroller" id="dateScroller"></div>
      </div>

      <div style="margin-top: 16px;">
        <label>Horários disponíveis</label>
        <div class="slots-grid" id="slotsGrid">
          <div style="font-size: 13px; color: var(--text-subtle); grid-column: 1 / -1;">Carregando horários...</div>
        </div>
      </div>

      <div id="bookingForm" style="display: none; border-top: 1px solid var(--border); margin-top: 24px; padding-top: 20px;">
        <h3 style="font-size: 16px; margin-bottom: 12px;">Seus dados de confirmação</h3>
        <div class="form-group">
          <label>Seu nome *</label>
          <input type="text" id="guestName" placeholder="Como você se chama?" required>
        </div>
        <div class="form-group">
          <label>Seu e-mail *</label>
          <input type="email" id="guestEmail" placeholder="seu@email.com" required>
        </div>
        <div class="form-group">
          <label>Notas ou pauta (opcional)</label>
          <textarea id="guestNotes" rows="2" placeholder="O que gostaria de conversar?"></textarea>
        </div>
        <div class="error-banner" id="errorBanner"></div>
        <button class="btn-submit" id="btnConfirm">Confirmar Agendamento</button>
      </div>
    </div>

    <div class="card success-card" id="successCard" style="display: none;">
      <div class="success-icon">✓</div>
      <h1>Agendamento Confirmado!</h1>
      <p class="desc" id="successDetail" style="margin-top: 10px;"></p>
      <p style="font-size: 13px; color: var(--text-subtle); margin-top: 16px;">
        O anfitrião recebeu a notificação na agenda do Vito.
      </p>
    </div>

    <div class="powered">Agendado pelo <strong>Vito</strong> · Inteligência Executiva</div>
  </div>

  <script>
    const username = "{{.Username}}";
    const slug = "{{.Slug}}";
    let selectedDate = new Date();
    let selectedSlot = null;

    function initDates() {
      const scroller = document.getElementById('dateScroller');
      scroller.innerHTML = '';
      const today = new Date();
      for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        // 7 dias por decisão P2: booking vale sábado, domingo e feriados; backend filtra via DaysOfWeek.
        const btn = document.createElement('button');
        btn.className = 'date-btn' + (i === 0 ? ' active' : '');
        btn.innerHTML = '<span class="weekday">' + d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') + '</span><span class="day">' + d.getDate() + '</span>';
        btn.onclick = () => {
          document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectedDate = d;
          loadSlots(d);
        };
        scroller.appendChild(btn);
      }
      loadSlots(selectedDate);
    }

    function formatDate(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    async function loadSlots(date) {
      const grid = document.getElementById('slotsGrid');
      const form = document.getElementById('bookingForm');
      grid.innerHTML = '<div style="font-size: 13px; color: var(--text-subtle); grid-column: 1 / -1;">Buscando horários livres...</div>';
      form.style.display = 'none';
      selectedSlot = null;

      try {
        const res = await fetch('/api/public/book/' + username + '/' + slug + '/slots?date=' + formatDate(date));
        const slots = await res.json();
        grid.innerHTML = '';
        if (!slots || slots.length === 0) {
          grid.innerHTML = '<div style="font-size: 13px; color: var(--text-subtle); grid-column: 1 / -1;">Nenhum horário vago para esta data.</div>';
          return;
        }

        let hasAvailable = false;
        slots.forEach(s => {
          const btn = document.createElement('button');
          btn.className = 'slot-btn';
          btn.textContent = s.time_label;
          if (!s.available) {
            btn.disabled = true;
          } else {
            hasAvailable = true;
            btn.onclick = () => {
              document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
              btn.classList.add('selected');
              selectedSlot = s;
              form.style.display = 'block';
              form.scrollIntoView({ behavior: 'smooth' });
            };
          }
          grid.appendChild(btn);
        });

        if (!hasAvailable) {
          grid.innerHTML = '<div style="font-size: 13px; color: var(--text-subtle); grid-column: 1 / -1;">Todos os horários desta data já foram preenchidos.</div>';
        }
      } catch (e) {
        grid.innerHTML = '<div style="font-size: 13px; color: var(--error); grid-column: 1 / -1;">Erro ao carregar horários.</div>';
      }
    }

    document.getElementById('btnConfirm').onclick = async () => {
      const errBanner = document.getElementById('errorBanner');
      errBanner.style.display = 'none';
      const name = document.getElementById('guestName').value.trim();
      const email = document.getElementById('guestEmail').value.trim();
      const notes = document.getElementById('guestNotes').value.trim();

      if (!name || !email) {
        errBanner.textContent = 'Por favor, preencha seu nome e e-mail.';
        errBanner.style.display = 'block';
        return;
      }
      if (!selectedSlot) {
        errBanner.textContent = 'Selecione um horário.';
        errBanner.style.display = 'block';
        return;
      }

      const btn = document.getElementById('btnConfirm');
      btn.disabled = true;
      btn.textContent = 'Reservando...';

      try {
        const res = await fetch('/api/public/book/' + username + '/' + slug + '/reserve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guest_name: name,
            guest_email: email,
            guest_notes: notes,
            start_at: selectedSlot.start_at,
            end_at: selectedSlot.end_at
          })
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          errBanner.textContent = data.error || 'Não foi possível confirmar o agendamento. Tente outro horário.';
          errBanner.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Confirmar Agendamento';
          return;
        }

        document.getElementById('bookingCard').style.display = 'none';
        document.getElementById('successCard').style.display = 'block';
        document.getElementById('successDetail').textContent = 'Horário reservado para ' + name + ' às ' + selectedSlot.time_label + ' em ' + selectedDate.toLocaleDateString('pt-BR');
      } catch (e) {
        errBanner.textContent = 'Erro de conexão ao reservar.';
        errBanner.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Confirmar Agendamento';
      }
    };

    window.addEventListener('DOMContentLoaded', initDates);
  </script>
</body>
</html>`
