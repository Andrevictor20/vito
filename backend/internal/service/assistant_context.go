package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service/assistant"
)

// holidayQueryKeywords espelha ClassifyEvent/CheckConflict: termos que, combinados
// com categoria holiday ou duração de dia inteiro, identificam feriados e datas
// comemorativas vindos do Google — que não são compromissos.
var holidayQueryKeywords = []string{
	"feriado", "nossa senhora", "aparecida", "ano novo", "confraternização",
	"carnaval", "quarta-feira de cinzas", "quarta de cinzas", "sexta-feira santa",
	"paixão de cristo", "páscoa", "pascoa", "tiradentes", "dia do trabalho",
	"dia do trabalhador", "corpus christi", "independência", "independencia",
	"finados", "proclamação da república", "proclamacao da republica",
	"consciência negra", "consciencia negra", "natal", "véspera de natal",
	"vespera de natal", "véspera de ano novo", "vespera de ano novo",
	"dia das mães", "dia dos pais", "dia das crianças", "holiday",
	"réveillon", "reveillon",
}

// enrichInputContext injeta dados contextuais dinâmicos (perfil fixo, memória, agenda, janelas livres, tarefas, radares e bookings)
// no input do usuário em paralelo (sync.WaitGroup) antes de enviar ao gateway de IA.
func (s *AssistantService) enrichInputContext(ctx context.Context, userID string, input *ai.UserInput) {
	loc := userLocation(input.Timezone)
	now := input.Now
	queryText := input.Text

	needAutonomy := input.AutonomyMode == "" && s.aiSettingsRepo != nil
	needUserName := input.UserName == "" && s.userRepo != nil
	needCoreProfile := len(input.CoreProfile) == 0 && s.coreProfileRepo != nil
	needMemories := len(input.ContextMemories) == 0 && s.memoryRepo != nil
	needSchedule := len(input.ActiveSchedule) == 0 && s.calSvc != nil
	needTodos := len(input.PendingTodos) == 0 && s.todoSvc != nil
	needTriggers := len(input.ActiveTriggers) == 0 && s.triggerSvc != nil
	needTriggerAlerts := len(input.ActiveTriggerAlerts) == 0
	needBookings := len(input.ActiveBookings) == 0 && s.bookingSvc != nil
	needAppointments := len(input.UpcomingAppointments) == 0 && s.bookingSvc != nil
	needGmail := s.gmailSvc != nil && len(input.RecentEmails) == 0
	needDirectory := s.waDirectory != nil && input.WhatsAppPrivateScope && len(input.ContactDirectory) == 0
	needPending := s.waDirectory != nil && input.WhatsAppPrivateScope && len(input.PendingConversations) == 0

	var (
		autonomyMode      string
		userName          string
		coreProfileLines  []string
		contextMemories   []string
		activeSchedule    []string
		freeSlotsFlags    []string
		pendingTodos      []string
		activeTriggers    []string
		triggerAlertLines []string
		triggerFlags      []string
		activeBookings    []string
		upcomingAppts     []string
		recentEmailLines  []string
		contactDirectory  []ai.ChatContactSummary
		pendingChats      []ai.ChatContactSummary
		gmailFlag         string
		wg                sync.WaitGroup
	)

	if needAutonomy {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if aiSettings, err := s.aiSettingsRepo.GetSettings(userID); err == nil && aiSettings != nil {
				autonomyMode = string(aiSettings.AutonomyMode)
			}
		}()
	}

	if needUserName {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if u, err := s.userRepo.GetByID(userID); err == nil && u != nil && strings.TrimSpace(u.Name) != "" {
				userName = strings.TrimSpace(u.Name)
			}
		}()
	}

	if needCoreProfile {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if items, err := s.coreProfileRepo.GetAll(userID); err == nil && len(items) > 0 {
				for _, it := range items {
					k := strings.TrimSpace(it.Key)
					v := strings.TrimSpace(it.Value)
					if k != "" && v != "" {
						coreProfileLines = append(coreProfileLines, fmt.Sprintf("%s: %s", k, v))
					}
				}
			}
		}()
	}

	if needMemories {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if mems, err := s.memoryRepo.SearchRelevant(userID, queryText, 8); err == nil && len(mems) > 0 {
				for _, m := range mems {
					contextMemories = append(contextMemories, fmt.Sprintf("[%s] %s", m.Category, m.Content))
				}
			}
		}()
	}

	if needSchedule {
		wg.Add(1)
		go func() {
			defer wg.Done()
			start := now
			end := now.Add(14 * 24 * time.Hour)
			events, err := s.calSvc.ListEvents(userID, start, end)
			if err == nil {
				freeSlotsFlags = assistant.ComputeFreeSlotsSummary(events, now, loc)
				if len(events) > 0 {
					limit := 15
					if len(events) < limit {
						limit = len(events)
					}
					for _, ev := range events[:limit] {
						line := assistant.FormatScheduleLine(ev, loc)
						if isHolidayLikeEvent(ev) {
							line += " [feriado/data comemorativa — NÃO é um compromisso]"
						}
						activeSchedule = append(activeSchedule, line)
					}
				}
			}
		}()
	}

	if needTodos {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if todos, err := s.todoSvc.ListTodos(userID, domain.TodoStatusPending); err == nil && len(todos) > 0 {
				limit := 5
				if len(todos) < limit {
					limit = len(todos)
				}
				for _, td := range todos[:limit] {
					pendingTodos = append(pendingTodos, assistant.FormatTodoLine(td, loc))
				}
			}
		}()
	}

	if needTriggers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if trigs, err := s.triggerSvc.ListTriggers(userID, "", domain.TriggerStatusActive); err == nil && len(trigs) > 0 {
				limit := 8
				if len(trigs) < limit {
					limit = len(trigs)
				}
				var trigIDs []string
				for _, tr := range trigs[:limit] {
					activeTriggers = append(activeTriggers, assistant.FormatTriggerLine(tr))
					trigIDs = append(trigIDs, tr.ID)
				}
				if needTriggerAlerts {
					logsByTrigger, _ := s.triggerSvc.ListUnreadLogsByTriggerIDs(userID, trigIDs)
					triggerAlertLines = assistant.CollectTriggerAlerts(trigs[:limit], logsByTrigger, 3)
				}
				triggerFlags = []string{
					fmt.Sprintf("radares_ativos:%d", len(trigs[:limit])),
					fmt.Sprintf("alertas_radar_nao_lidos:%d", len(triggerAlertLines)),
				}
			}
		}()
	}

	if needBookings {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if bts, err := s.bookingSvc.ListBookingTypes(ctx, userID); err == nil && len(bts) > 0 {
				for _, bt := range bts {
					if bt.IsActive {
						url := bt.ShortURL
						if url == "" {
							url = bt.PublicURL
						}
						activeBookings = append(activeBookings, assistant.FormatBookingLine(bt.Title, bt.DurationMinutes, bt.StartHour, bt.EndHour, url))
					}
				}
			}
		}()
	}

	if needAppointments {
		wg.Add(1)
		go func() {
			defer wg.Done()
			from := now.Add(-1 * 24 * time.Hour)
			to := now.Add(30 * 24 * time.Hour)
			if appts, err := s.bookingSvc.ListAppointments(ctx, userID, from, to); err == nil && len(appts) > 0 {
				for _, ap := range appts {
					if ap.Status != "cancelled" {
						apStart, apEnd := ap.StartAt.In(loc), ap.EndAt.In(loc)
						upcomingAppts = append(upcomingAppts, fmt.Sprintf("Convidado %s (%s, %s às %s - %s) [ID: %s]",
							ap.GuestName, ap.GuestEmail, apStart.Format("02/01/2006"), apStart.Format("15:04"), apEnd.Format("15:04"), ap.ID,
						))
					}
				}
			}
		}()
	}

	if needDirectory {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if dir, err := s.waDirectory.Directory(ctx, userID); err == nil {
				contactDirectory = dir
			}
		}()
	}

	if needPending {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if pend, err := s.waDirectory.PendingSummaries(ctx, userID); err == nil {
				pendingChats = pend
			}
		}()
	}

	if needGmail {
		wg.Add(1)
		go func() {
			defer wg.Done()
			st, err := s.gmailSvc.GetStatus(ctx, userID)
			if err != nil || st == nil {
				return
			}

			if !st.Connected {
				if st.Status == domain.GmailStatusReauthRequired {
					gmailFlag = "[INTEGRAÇÃO GMAIL: Reconexão necessária (autorização expirada)]"
					qLower := strings.ToLower(queryText)
					if strings.Contains(qLower, "email") || strings.Contains(qLower, "e-mail") || strings.Contains(qLower, "gmail") {
						recentEmailLines = append(recentEmailLines, "[AVISO GMAIL: A autorização do Gmail expirou. Oriente o usuário a reconectar o Gmail nas configurações do app.]")
					}
				}
				return
			}

			accEmail := st.AccountEmail
			if accEmail == "" {
				accEmail = st.Email
			}
			gmailFlag = fmt.Sprintf("[INTEGRAÇÃO GMAIL ATIVA: conta=%s]", accEmail)
			qLower := strings.ToLower(queryText)
			hasEmailIntent := strings.Contains(qLower, "email") || strings.Contains(qLower, "e-mail") ||
				strings.Contains(qLower, "gmail") || strings.Contains(qLower, "fatura") ||
				strings.Contains(qLower, "boleto") || strings.Contains(qLower, "voo") ||
				strings.Contains(qLower, "passagem") || strings.Contains(qLower, "inbox") ||
				strings.Contains(qLower, "correio") || strings.Contains(qLower, "caixa") ||
				strings.Contains(qLower, "spam") || strings.Contains(qLower, "lixeira") ||
				strings.Contains(qLower, "lixo") || strings.Contains(qLower, "promo") ||
				strings.Contains(qLower, "newsletter")

			if hasEmailIntent {
				opts := ScanOptions{
					Folder:     "primary", // Padrão: Caixa Principal
					UnreadOnly: false,
					Limit:      10,
				}

				// Triagem seletiva de caixas adicionais apenas se solicitado explicitamente
				if strings.Contains(qLower, "spam") {
					opts.Folder = "spam"
				} else if strings.Contains(qLower, "lixeira") || strings.Contains(qLower, "lixo") {
					opts.Folder = "trash"
				} else if strings.Contains(qLower, "promo") || strings.Contains(qLower, "oferta") || strings.Contains(qLower, "newsletter") {
					opts.Folder = "promotions"
				} else if strings.Contains(qLower, "social") || strings.Contains(qLower, "redes sociais") {
					opts.Folder = "social"
				} else if strings.Contains(qLower, "atualizaç") || strings.Contains(qLower, "atualizac") || strings.Contains(qLower, "updates") {
					opts.Folder = "updates"
				} else if strings.Contains(qLower, "todas as caixas") || strings.Contains(qLower, "todos os e-mails") || strings.Contains(qLower, "todos os emails") || strings.Contains(qLower, "qualquer pasta") {
					opts.Folder = "all"
				}

				// Filtro de mensagens não lidas
				if strings.Contains(qLower, "não lido") || strings.Contains(qLower, "nao lido") ||
					strings.Contains(qLower, "não lidas") || strings.Contains(qLower, "nao lidas") ||
					strings.Contains(qLower, "pendente") {
					opts.UnreadOnly = true
				}

				folderLabel := "Caixa Principal"
				switch opts.Folder {
				case "spam":
					folderLabel = "Spam"
				case "trash":
					folderLabel = "Lixeira"
				case "promotions":
					folderLabel = "Promoções"
				case "social":
					folderLabel = "Social"
				case "updates":
					folderLabel = "Atualizações"
				case "all":
					folderLabel = "Todas as Pastas"
				}

				scan, scanErr := s.gmailSvc.ScanEmailsWithOptions(ctx, userID, opts)
				if scanErr == nil && scan != nil {
					for _, b := range scan.Bills {
						dueStr := "a definir"
						if b.DueDate != nil {
							dueStr = b.DueDate.Format("02/01/2006")
						}
						recentEmailLines = append(recentEmailLines, fmt.Sprintf("[BOLETO/FATURA] %s (R$ %.2f, Vence: %s, Beneficiário: %s) - Linha: %s", b.Subject, b.AmountBRL, dueStr, b.Beneficiary, b.Barcode))
					}
					for _, f := range scan.Flights {
						recentEmailLines = append(recentEmailLines, fmt.Sprintf("[VOO] %s (Voo %s, Localizador: %s, %s -> %s)", f.Airline, f.FlightNum, f.BookingCode, f.Origin, f.Destination))
					}
					for _, u := range scan.UrgentEmails {
						readStatus := "[LIDO]"
						if u.IsUnread {
							readStatus = "[NÃO LIDO]"
						}
						dateStr := u.Date.Format("02/01 15:04")
						recentEmailLines = append(recentEmailLines, fmt.Sprintf("[%s - %s] %s | De: %s | Assunto: %s | Trecho: %s", folderLabel, readStatus, dateStr, u.From, u.Subject, u.Snippet))
					}
					if len(scan.Bills) == 0 && len(scan.Flights) == 0 && len(scan.UrgentEmails) == 0 {
						recentEmailLines = append(recentEmailLines, fmt.Sprintf("[STATUS GMAIL: Varredura realizada na pasta '%s', nenhuma mensagem encontrada.]", folderLabel))
					}
				} else if scanErr != nil {
					if errors.Is(scanErr, domain.ErrGmailAuthFailed) {
						recentEmailLines = append(recentEmailLines, "[AVISO GMAIL: O acesso ao Gmail expirou e precisa ser reconectado no app.]")
					}
				}
			}
		}()
	}

	wg.Wait()

	if autonomyMode != "" {
		input.AutonomyMode = autonomyMode
	}
	if userName != "" {
		input.UserName = userName
	}
	if len(coreProfileLines) > 0 {
		input.CoreProfile = coreProfileLines
	}
	if len(contextMemories) > 0 {
		input.ContextMemories = contextMemories
	}
	if len(activeSchedule) > 0 {
		input.ActiveSchedule = activeSchedule
	}
	if len(freeSlotsFlags) > 0 {
		input.AppStateFlags = append(input.AppStateFlags, freeSlotsFlags...)
	}
	if len(pendingTodos) > 0 {
		input.PendingTodos = pendingTodos
	}
	if len(activeTriggers) > 0 {
		input.ActiveTriggers = activeTriggers
	}
	if len(triggerAlertLines) > 0 {
		input.ActiveTriggerAlerts = triggerAlertLines
	}
	if len(triggerFlags) > 0 {
		input.AppStateFlags = append(input.AppStateFlags, triggerFlags...)
	}
	if len(activeBookings) > 0 {
		input.ActiveBookings = activeBookings
	}
	if len(upcomingAppts) > 0 {
		input.UpcomingAppointments = upcomingAppts
	}
	if len(recentEmailLines) > 0 {
		input.RecentEmails = recentEmailLines
	}
	if len(contactDirectory) > 0 {
		input.ContactDirectory = contactDirectory
	}
	if len(pendingChats) > 0 {
		input.PendingConversations = pendingChats
	}
	if len(contactDirectory) > 0 || len(pendingChats) > 0 {
		log.Printf("🧠 [WhatsAppContext] diretório=%d contato(s) pendências=%d conversa(s) (escopo privado=%v)",
			len(contactDirectory), len(pendingChats), input.WhatsAppPrivateScope)
	}
	if gmailFlag != "" {
		input.AppStateFlags = append(input.AppStateFlags, gmailFlag)
	}
}

func userLocation(timezone string) *time.Location {
	if timezone != "" {
		if loc, err := time.LoadLocation(timezone); err == nil {
			return loc
		}
	}
	return time.FixedZone("BRT", -3*3600)
}

// isHolidayLikeEvent identifica feriados/datas comemorativas (ex: calendário de
// feriados do Google): categoria holiday/feriado sempre; por título, só quando
// dia inteiro (dura >= 20h ou ancora na meia-noite) para não excluir
// compromissos reais com nome parecido ("Jantar de Natal 20h" continua evento).
func isHolidayLikeEvent(ev domain.Event) bool {
	cat := strings.ToLower(strings.TrimSpace(ev.Category))
	if cat == "holiday" || cat == "feriado" {
		return true
	}
	combined := strings.ToLower(strings.TrimSpace(ev.Title + " " + ev.Description))
	matched := false
	for _, kw := range holidayQueryKeywords {
		if strings.Contains(combined, kw) {
			matched = true
			break
		}
	}
	if !matched {
		return false
	}
	if ev.EndAt.Sub(ev.StartAt) >= 20*time.Hour {
		return true
	}
	if ev.StartAt.Hour() == 0 && ev.StartAt.Minute() == 0 {
		return true
	}
	return false
}

// queryDayLabel rotula o dia consultado em linguagem natural: hoje/amanhã ou
// dia da semana com data (ex: "sábado (17/10)"). Sem data-alvo, vale hoje.
func queryDayLabel(now, target time.Time) string {
	ymd := func(t time.Time) string { return t.Format("2006-01-02") }
	switch ymd(target) {
	case ymd(now):
		return "hoje"
	case ymd(now.Add(24 * time.Hour)):
		return "amanhã"
	default:
		return fmt.Sprintf("no %s (%s)",
			strings.ToLower(ai.WeekdayPT(target.Weekday())), target.Format("02/01"))
	}
}
