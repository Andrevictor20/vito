package service

import (
	"database/sql"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// ExecutiveSummaryWorker monitora os horários de fechamento de ciclos (diário, semanal e mensal)
// e despacha notificações executivas informando que os resumos estão disponíveis.
type ExecutiveSummaryWorker struct {
	db            *sql.DB
	userRepo      domain.UserRepository
	notifSvc      *NotificationService
	checkInterval time.Duration
	location      *time.Location
	stopCh        chan struct{}
	wg            sync.WaitGroup
	running       bool
	mu            sync.Mutex
}

// NewExecutiveSummaryWorker instancia o worker de resumos executivos.
func NewExecutiveSummaryWorker(
	db *sql.DB,
	userRepo domain.UserRepository,
	notifSvc *NotificationService,
	checkInterval ...time.Duration,
) *ExecutiveSummaryWorker {
	interval := 1 * time.Minute
	if len(checkInterval) > 0 && checkInterval[0] > 0 {
		interval = checkInterval[0]
	}

	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		loc = time.FixedZone("BRT", -3*3600)
	}

	return &ExecutiveSummaryWorker{
		db:            db,
		userRepo:      userRepo,
		notifSvc:      notifSvc,
		checkInterval: interval,
		location:      loc,
		stopCh:        make(chan struct{}),
	}
}

// SetLocation permite customizar o timezone para testes unitários.
func (w *ExecutiveSummaryWorker) SetLocation(loc *time.Location) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.location = loc
}

// isAlreadyDispatched verifica idempotência no banco de dados.
func (w *ExecutiveSummaryWorker) isAlreadyDispatched(userID, summaryType, periodKey string) bool {
	if w.db == nil {
		return false
	}
	var count int
	query := `SELECT COUNT(*) FROM summary_dispatches WHERE user_id = ? AND summary_type = ? AND period_key = ?`
	err := w.db.QueryRow(query, userID, summaryType, periodKey).Scan(&count)
	return err == nil && count > 0
}

// markDispatched registra que a notificação foi enviada.
func (w *ExecutiveSummaryWorker) markDispatched(userID, summaryType, periodKey string, now time.Time) error {
	if w.db == nil {
		return nil
	}
	query := `
		INSERT INTO summary_dispatches (id, user_id, summary_type, period_key, dispatched_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(user_id, summary_type, period_key) DO NOTHING
	`
	_, err := w.db.Exec(query, uuid.New().String(), userID, summaryType, periodKey, now.UTC())
	return err
}

// listUserIDs busca todos os usuários com tokens registrados ou ativos no banco.
func (w *ExecutiveSummaryWorker) listUserIDs() ([]string, error) {
	if w.db == nil {
		return nil, nil
	}
	query := `SELECT id FROM users`
	rows, err := w.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var userIDs []string
	for rows.Next() {
		var uid string
		if err := rows.Scan(&uid); err == nil {
			userIDs = append(userIDs, uid)
		}
	}
	return userIDs, rows.Err()
}

// CheckAndDispatchSummaries avalia os horários diário, semanal e mensal e despacha alertas.
func (w *ExecutiveSummaryWorker) CheckAndDispatchSummaries(now time.Time) (int, error) {
	w.mu.Lock()
	loc := w.location
	w.mu.Unlock()

	userNow := now.In(loc)
	timeHM := userNow.Format("15:04")
	dispatchedCount := 0

	userIDs, err := w.listUserIDs()
	if err != nil || len(userIDs) == 0 {
		return 0, err
	}

	for _, userID := range userIDs {
		// 1. Resumo Diário (todos os dias às 20:30)
		if timeHM == "20:30" {
			periodKey := userNow.Format("2006-01-02")
			if !w.isAlreadyDispatched(userID, "daily", periodKey) {
				title := "🌅 Balanço do Dia Concluído"
				body := "O Vito fechou o panorama do seu dia. Veja tarefas concluídas e compromissos na Central de Resumos."
				data := map[string]interface{}{
					"type":      "daily_summary",
					"date":      periodKey,
					"channelId": "vito_summaries",
				}
				if w.notifSvc != nil {
					_, _ = w.notifSvc.SendPushToUser(userID, title, body, "default", data)
				}
				_ = w.markDispatched(userID, "daily", periodKey, now)
				dispatchedCount++
			}
		}

		// 2. Balanço Semanal (Domingos às 20:00)
		if userNow.Weekday() == time.Sunday && timeHM == "20:00" {
			_, week := userNow.ISOWeek()
			periodKey := fmt.Sprintf("%d-W%02d", userNow.Year(), week)
			if !w.isAlreadyDispatched(userID, "weekly", periodKey) {
				title := "📊 Balanço Semanal Disponível"
				body := "Seu Raio-X semanal está pronto! Confira sua distribuição de tempo e produtividade na Central de Resumos."
				data := map[string]interface{}{
					"type":      "weekly_summary",
					"week":      periodKey,
					"channelId": "vito_summaries",
				}
				if w.notifSvc != nil {
					_, _ = w.notifSvc.SendPushToUser(userID, title, body, "default", data)
				}
				_ = w.markDispatched(userID, "weekly", periodKey, now)
				dispatchedCount++
			}
		}

		// 3. Perspectiva Mensal (1º dia de cada mês às 09:00)
		if userNow.Day() == 1 && timeHM == "09:00" {
			periodKey := userNow.Format("2006-01")
			if !w.isAlreadyDispatched(userID, "monthly", periodKey) {
				title := "🗓️ Perspectiva Mensal Consolidada"
				body := "Novo mês iniciado! O balanço do mês anterior foi consolidado para sua reflexão na Central de Resumos."
				data := map[string]interface{}{
					"type":      "monthly_summary",
					"month":     periodKey,
					"channelId": "vito_summaries",
				}
				if w.notifSvc != nil {
					_, _ = w.notifSvc.SendPushToUser(userID, title, body, "default", data)
				}
				_ = w.markDispatched(userID, "monthly", periodKey, now)
				dispatchedCount++
			}
		}
	}

	return dispatchedCount, nil
}

// Start inicia o loop de background do worker de resumos.
func (w *ExecutiveSummaryWorker) Start() {
	w.mu.Lock()
	if w.running {
		w.mu.Unlock()
		return
	}
	w.running = true
	w.stopCh = make(chan struct{})
	w.mu.Unlock()

	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		ticker := time.NewTicker(w.checkInterval)
		defer ticker.Stop()

		log.Printf("📊 [ExecutiveSummaryWorker] Monitor de resumos diários/semanais/mensais iniciado (intervalo: %v).", w.checkInterval)

		for {
			select {
			case <-w.stopCh:
				log.Println("📊 [ExecutiveSummaryWorker] Encerrado.")
				return
			case t := <-ticker.C:
				if count, err := w.CheckAndDispatchSummaries(t); err != nil {
					log.Printf("[ExecutiveSummaryWorker] Erro ao despachar resumos: %v", err)
				} else if count > 0 {
					log.Printf("📊 [ExecutiveSummaryWorker] %d resumo(s) executivo(s) despachado(s).", count)
				}
			}
		}
	}()
}

// Stop finaliza graciosamente a execução do worker.
func (w *ExecutiveSummaryWorker) Stop() {
	w.mu.Lock()
	if !w.running {
		w.mu.Unlock()
		return
	}
	w.running = false
	close(w.stopCh)
	w.mu.Unlock()

	w.wg.Wait()
}
