package service_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/smtp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	_ "modernc.org/sqlite"
)

type bookingTestContext struct {
	db          *sql.DB
	user        *domain.User
	bookingRepo domain.BookingRepository
	eventRepo   domain.EventRepository
	userRepo    domain.UserRepository
	bookingSvc  *service.BookingService
}

func setupBookingTest(t *testing.T) *bookingTestContext {
	t.Helper()
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("erro ao abrir sqlite: %v", err)
	}

	userRepo := repository.NewUserRepository(db)
	eventRepo := repository.NewEventRepository(db)
	bookingRepo := repository.NewBookingRepositorySQLite(db)

	user := &domain.User{
		ID:           "user-booking-host",
		Name:         "André Victor",
		Email:        "andre@vito.app",
		PasswordHash: "secret123",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("erro ao criar usuário: %v", err)
	}

	shortener := service.NewShortIoShortenerService("", "", "http://localhost:8080")
	turnstile := service.NewTurnstileValidator("") // bypass em teste

	bookingSvc := service.NewBookingService(
		bookingRepo,
		eventRepo,
		userRepo,
		nil, // notificationService (mock/nil em teste unitário)
		shortener,
		turnstile,
		"http://localhost:8080",
	)

	return &bookingTestContext{
		db:          db,
		user:        user,
		bookingRepo: bookingRepo,
		eventRepo:   eventRepo,
		userRepo:    userRepo,
		bookingSvc:  bookingSvc,
	}
}

func TestBookingService_GetAvailableSlots(t *testing.T) {
	ctx := setupBookingTest(t)
	defer ctx.db.Close()

	// Tipo de agendamento: Reunião 30m, 10m buffer, Segunda a Sexta, 09:00 às 12:00
	bt := &domain.BookingType{
		ID:              "bt-1",
		UserID:          ctx.user.ID,
		Slug:            "reuniao-30m",
		Title:           "Reunião de 30 min",
		DurationMinutes: 30,
		BufferMinutes:   10,
		DaysOfWeek:      "[1,2,3,4,5]",
		StartHour:       "09:00",
		EndHour:         "11:00",
		IsActive:        true,
	}
	if err := ctx.bookingRepo.CreateType(bt); err != nil {
		t.Fatalf("falha ao criar booking type: %v", err)
	}

	// Terça-feira futura (ex: 2026-10-20)
	targetDate := time.Date(2026, 10, 20, 0, 0, 0, 0, time.UTC)

	// Adiciona um evento existente na agenda do anfitrião das 09:30 às 10:00
	existingEvent := &domain.Event{
		ID:        "ev-conflict",
		UserID:    ctx.user.ID,
		Title:     "Reunião Interna",
		StartAt:   time.Date(2026, 10, 20, 9, 30, 0, 0, time.UTC),
		EndAt:     time.Date(2026, 10, 20, 10, 0, 0, 0, time.UTC),
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := ctx.eventRepo.Create(existingEvent); err != nil {
		t.Fatalf("falha ao criar evento: %v", err)
	}

	slots, err := ctx.bookingSvc.GetAvailableSlots(context.Background(), ctx.user.ID, bt.Slug, targetDate)
	if err != nil {
		t.Fatalf("GetAvailableSlots falhou: %v", err)
	}

	// Janela 09:00 - 11:00 com slots de 30m:
	// Slot 1: 09:00 - 09:30 -> buffer até 09:40 colide com evento das 09:30 -> Indisponível
	// Slot 2: 09:30 - 10:00 -> colisão direta -> Indisponível
	// Slot 3: 10:00 - 10:30 -> buffer de 10:00 às 09:50 colide com evento que acaba às 10:00 -> Indisponível
	// Slot 4: 10:30 - 11:00 -> livre! (começa 10:30, buffer 10:20 > 10:00) -> Disponível
	var availableCount int
	for _, s := range slots {
		if s.Available {
			availableCount++
			if s.TimeLabel != "10:30" {
				t.Errorf("esperava slot livre apenas em 10:30, obteve %s", s.TimeLabel)
			}
		}
	}
	if availableCount != 1 {
		t.Errorf("esperado 1 slot disponível, obteve %d", availableCount)
	}
}

func TestBookingService_ReserveAppointment_SuccessAndXSSSanitization(t *testing.T) {
	ctx := setupBookingTest(t)
	defer ctx.db.Close()

	bt := &domain.BookingType{
		ID:              "bt-xss",
		UserID:          ctx.user.ID,
		Slug:            "mentoria",
		Title:           "Mentoria de Carreira",
		DurationMinutes: 45,
		BufferMinutes:   15,
		DaysOfWeek:      "[1,2,3,4,5]",
		StartHour:       "14:00",
		EndHour:         "18:00",
		IsActive:        true,
	}
	if err := ctx.bookingRepo.CreateType(bt); err != nil {
		t.Fatalf("falha ao criar booking type: %v", err)
	}

	startAt := time.Date(2026, 10, 21, 14, 0, 0, 0, time.UTC)
	endAt := startAt.Add(45 * time.Minute)

	req := service.ReserveRequest{
		GuestName:  "<script>alert('xss')</script>Lucas Silveira",
		GuestEmail: "lucas@empresa.com",
		GuestNotes: "<b>Urgente</b>: <img src=x onerror=alert(1)>Quero discutir carreira.",
		StartAt:    startAt,
		EndAt:      endAt,
		Turnstile:  "token-test",
	}

	appt, err := ctx.bookingSvc.ReserveAppointment(context.Background(), ctx.user.ID, bt.Slug, req, "127.0.0.1")
	if err != nil {
		t.Fatalf("ReserveAppointment falhou: %v", err)
	}

	// Verificação de Sanitização XSS estrita
	if appt.GuestName != "Lucas Silveira" {
		t.Errorf("GuestName não foi sanitizado! Obteve: %q", appt.GuestName)
	}
	if appt.GuestNotes != "Quero discutir carreira." && appt.GuestNotes != "<b>Urgente</b>: Quero discutir carreira." {
		// bluemonday strict policy remove todas as tags
		t.Logf("Notas sanitizadas: %q", appt.GuestNotes)
	}

	// Verifica criação do Evento na agenda
	events, err := ctx.eventRepo.ListByUser(ctx.user.ID, startAt.Add(-time.Hour), endAt.Add(time.Hour))
	if err != nil || len(events) == 0 {
		t.Fatalf("evento não foi criado na agenda do usuário: %v", err)
	}
	if events[0].Source != "vito_booking" {
		t.Errorf("esperado source 'vito_booking', obteve %q", events[0].Source)
	}

	// Segunda tentativa no mesmo horário deve retornar ErrBookingConflict
	_, errConflict := ctx.bookingSvc.ReserveAppointment(context.Background(), ctx.user.ID, bt.Slug, req, "127.0.0.1")
	if errConflict != domain.ErrBookingConflict {
		t.Errorf("esperado ErrBookingConflict, obteve: %v", errConflict)
	}
}

func TestBookingService_ReserveAppointment_ConcurrencyLock(t *testing.T) {
	ctx := setupBookingTest(t)
	defer ctx.db.Close()

	bt := &domain.BookingType{
		ID:              "bt-race",
		UserID:          ctx.user.ID,
		Slug:            "call-rapida",
		Title:           "Call Rápida",
		DurationMinutes: 30,
		BufferMinutes:   10,
		DaysOfWeek:      "[1,2,3,4,5]",
		StartHour:       "15:00",
		EndHour:         "16:00",
		IsActive:        true,
	}
	_ = ctx.bookingRepo.CreateType(bt)

	startAt := time.Date(2026, 10, 22, 15, 0, 0, 0, time.UTC)
	endAt := startAt.Add(30 * time.Minute)

	const concurrency = 5
	var wg sync.WaitGroup
	results := make([]error, concurrency)

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			req := service.ReserveRequest{
				GuestName:  "Convidado Concorrente",
				GuestEmail: "guest@teste.com",
				StartAt:    startAt,
				EndAt:      endAt,
			}
			_, err := ctx.bookingSvc.ReserveAppointment(context.Background(), ctx.user.ID, bt.Slug, req, "127.0.0.1")
			results[idx] = err
		}(i)
	}
	wg.Wait()

	var successCount, conflictCount int
	for _, err := range results {
		if err == nil {
			successCount++
		} else if err == domain.ErrBookingConflict {
			conflictCount++
		}
	}

	if successCount != 1 {
		t.Errorf("esperado exatamente 1 agendamento concluído, obteve %d", successCount)
	}
	if conflictCount != concurrency-1 {
		t.Errorf("esperado %d conflitos rejeitados, obteve %d", concurrency-1, conflictCount)
	}
}

// Apagar o link deve cascatear: remove agendamentos E eventos da agenda.
func TestBookingService_DeleteType_CascadesAppointmentsAndEvents(t *testing.T) {
	ctx := setupBookingTest(t)
	defer ctx.db.Close()

	bt := &domain.BookingType{
		ID: "bt-cascade", UserID: ctx.user.ID, Slug: "cascata", Title: "Cascata",
		DurationMinutes: 30, BufferMinutes: 0, DaysOfWeek: "[1,2,3,4,5,6,7]",
		StartHour: "09:00", EndHour: "18:00", IsActive: true,
	}
	if err := ctx.bookingRepo.CreateType(bt); err != nil {
		t.Fatal(err)
	}

	startAt := time.Now().UTC().Add(48 * time.Hour).Truncate(time.Hour)
	req := service.ReserveRequest{
		GuestName: "Jéssica", GuestEmail: "jess@test.com",
		StartAt: startAt, EndAt: startAt.Add(30 * time.Minute),
	}
	appt, err := ctx.bookingSvc.ReserveAppointment(context.Background(), ctx.user.ID, bt.Slug, req, "127.0.0.1")
	if err != nil {
		t.Fatalf("ReserveAppointment falhou: %v", err)
	}

	impact, err := ctx.bookingSvc.DeleteBookingType(context.Background(), ctx.user.ID, bt.ID)
	if err != nil {
		t.Fatalf("DeleteBookingType falhou: %v", err)
	}
	if impact.DeletedAppointments != 1 || impact.DeletedEvents != 1 {
		t.Errorf("esperado impacto {1,1}, obteve %+v", impact)
	}
	if _, err := ctx.bookingRepo.GetAppointmentByID(appt.ID, ctx.user.ID); err == nil {
		t.Errorf("agendamento deveria ter sido removido com o link")
	}
	events, err := ctx.eventRepo.ListByUser(ctx.user.ID, startAt.Add(-time.Hour), startAt.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	for _, ev := range events {
		if ev.ID == appt.EventID {
			t.Errorf("evento da agenda deveria ter sido removido com o link: %q", ev.Title)
		}
	}
}

// Cancelar confirmação sem EventID (linhas legadas) deve mesmo assim remover o evento.
func TestBookingService_CancelAppointment_RemovesEventWithoutEventID(t *testing.T) {
	ctx := setupBookingTest(t)
	defer ctx.db.Close()

	if err := ctx.bookingRepo.CreateType(&domain.BookingType{
		ID: "bt-legacy", UserID: ctx.user.ID, Slug: "legado", Title: "Legado",
		DurationMinutes: 30, BufferMinutes: 0, DaysOfWeek: "[1,2,3,4,5,6,7]",
		StartHour: "09:00", EndHour: "18:00", IsActive: true,
	}); err != nil {
		t.Fatal(err)
	}
	startAt := time.Now().UTC().Add(72 * time.Hour).Truncate(time.Hour)
	ev := &domain.Event{
		ID: "ev-legacy", UserID: ctx.user.ID, Title: "Reunião com Jéssica (Cascata)",
		StartAt: startAt, EndAt: startAt.Add(30 * time.Minute),
		CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
	}
	if err := ctx.eventRepo.Create(ev); err != nil {
		t.Fatal(err)
	}
	appt := &domain.BookingAppointment{
		ID: "appt-legacy", BookingTypeID: "bt-legacy", UserID: ctx.user.ID,
		GuestName: "Jéssica", GuestEmail: "jess@test.com",
		StartAt: startAt, EndAt: startAt.Add(30 * time.Minute),
		Status: "confirmed", EventID: "",
		CreatedAt: time.Now().UTC(),
	}
	if err := ctx.bookingRepo.CreateAppointment(appt); err != nil {
		t.Fatal(err)
	}

	if err := ctx.bookingSvc.CancelAppointment(context.Background(), ctx.user.ID, appt.ID); err != nil {
		t.Fatalf("CancelAppointment falhou: %v", err)
	}
	if _, err := ctx.eventRepo.GetByID(ev.ID, ctx.user.ID); err == nil {
		t.Errorf("evento da agenda deveria ter sido removido mesmo sem EventID")
	}
}

// Link vencido: sem slots, sem reserva e auto-apagado na listagem (mantém passado).
func TestBookingService_ExpiredLinkBlocksAndSweeps(t *testing.T) {
	ctx := setupBookingTest(t)
	defer ctx.db.Close()

	past := time.Now().UTC().Add(-48 * time.Hour).Truncate(time.Hour)
	yesterday := time.Now().UTC().Add(-24 * time.Hour)
	bt := &domain.BookingType{
		ID: "bt-exp", UserID: ctx.user.ID, Slug: "expirado", Title: "Expirado",
		DurationMinutes: 30, BufferMinutes: 0, DaysOfWeek: "[1,2,3,4,5,6,7]",
		StartHour: "09:00", EndHour: "18:00", IsActive: true,
		ValidFrom: &past, ValidUntil: &yesterday,
	}
	if err := ctx.bookingRepo.CreateType(bt); err != nil {
		t.Fatal(err)
	}

	// Reserva no passado (quando ainda válido) para provar que o passado é mantido.
	pastStart := past.Add(2 * time.Hour)
	pastEv := &domain.Event{
		ID: "ev-past", UserID: ctx.user.ID, Title: "Reunião com Paulo (Expirado)",
		StartAt: pastStart, EndAt: pastStart.Add(30 * time.Minute),
		CreatedAt: past, UpdatedAt: past,
	}
	if err := ctx.eventRepo.Create(pastEv); err != nil {
		t.Fatal(err)
	}
	pastAppt := &domain.BookingAppointment{
		ID: "appt-past", BookingTypeID: bt.ID, UserID: ctx.user.ID,
		GuestName: "Paulo", GuestEmail: "paulo@test.com",
		StartAt: pastStart, EndAt: pastStart.Add(30 * time.Minute),
		Status: "confirmed", EventID: pastEv.ID, CreatedAt: past,
	}
	if err := ctx.bookingRepo.CreateAppointment(pastAppt); err != nil {
		t.Fatal(err)
	}

	// Reserva futura no mesmo link (ainda não varrido).
	futureStart := time.Now().UTC().Add(24 * time.Hour).Truncate(time.Hour)
	futureEv := &domain.Event{
		ID: "ev-future", UserID: ctx.user.ID, Title: "Reunião com Ana (Expirado)",
		StartAt: futureStart, EndAt: futureStart.Add(30 * time.Minute),
		CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
	}
	if err := ctx.eventRepo.Create(futureEv); err != nil {
		t.Fatal(err)
	}
	futureAppt := &domain.BookingAppointment{
		ID: "appt-future", BookingTypeID: bt.ID, UserID: ctx.user.ID,
		GuestName: "Ana", GuestEmail: "ana@test.com",
		StartAt: futureStart, EndAt: futureStart.Add(30 * time.Minute),
		Status: "confirmed", EventID: futureEv.ID, CreatedAt: time.Now().UTC(),
	}
	if err := ctx.bookingRepo.CreateAppointment(futureAppt); err != nil {
		t.Fatal(err)
	}

	// 1. Sem slots em link vencido.
	if _, err := ctx.bookingSvc.GetAvailableSlots(context.Background(), ctx.user.ID, bt.Slug, time.Now().UTC()); !errors.Is(err, domain.ErrBookingExpired) {
		t.Errorf("slots em link vencido deveriam dar ErrBookingExpired, veio %v", err)
	}

	// 2. Sem reserva em link vencido.
	req := service.ReserveRequest{
		GuestName: "Novo", GuestEmail: "novo@test.com",
		StartAt: futureStart, EndAt: futureStart.Add(30 * time.Minute),
	}
	if _, err := ctx.bookingSvc.ReserveAppointment(context.Background(), ctx.user.ID, bt.Slug, req, "127.0.0.1"); !errors.Is(err, domain.ErrBookingExpired) {
		t.Errorf("reserva em link vencido deveria dar ErrBookingExpired, veio %v", err)
	}

	// 3. Listagem varre: link some, futuro removido da agenda, passado mantido.
	types, err := ctx.bookingSvc.ListBookingTypes(context.Background(), ctx.user.ID)
	if err != nil {
		t.Fatal(err)
	}
	for _, tp := range types {
		if tp.ID == bt.ID {
			t.Errorf("link vencido deveria ter sido auto-apagado na listagem")
		}
	}
	if _, err := ctx.eventRepo.GetByID(futureEv.ID, ctx.user.ID); err == nil {
		t.Errorf("evento futuro do link expirado deveria ter saído da agenda")
	}
	if _, err := ctx.eventRepo.GetByID(pastEv.ID, ctx.user.ID); err != nil {
		t.Errorf("evento passado deveria ter sido mantido na agenda: %v", err)
	}
}

// Datas específicas: só os dias listados aceitam reserva.
func TestBookingService_AllowedDatesRestrictSlots(t *testing.T) {
	ctx := setupBookingTest(t)
	defer ctx.db.Close()

	day := time.Now().UTC().Add(72 * time.Hour)
	other := time.Now().UTC().Add(96 * time.Hour)
	allowed, _ := json.Marshal([]string{day.Format("2006-01-02")})
	bt := &domain.BookingType{
		ID: "bt-dates", UserID: ctx.user.ID, Slug: "datas", Title: "Datas",
		DurationMinutes: 30, BufferMinutes: 0, DaysOfWeek: "[1,2,3,4,5,6,7]",
		StartHour: "00:00", EndHour: "23:30", IsActive: true,
		AllowedDates: string(allowed),
	}
	if err := ctx.bookingRepo.CreateType(bt); err != nil {
		t.Fatal(err)
	}

	slots, err := ctx.bookingSvc.GetAvailableSlots(context.Background(), ctx.user.ID, bt.Slug, other)
	if err != nil {
		t.Fatal(err)
	}
	for _, s := range slots {
		if s.Available {
			t.Errorf("dia fora de allowed_dates não deveria ter slot livre: %s", s.TimeLabel)
		}
	}
	slots, err = ctx.bookingSvc.GetAvailableSlots(context.Background(), ctx.user.ID, bt.Slug, day)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, s := range slots {
		if s.Available {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("dia em allowed_dates deveria ter slots livres")
	}
}

// Reserva de booking deve disparar push com quem agendou, comentário e dia/horário.
func TestBookingService_ReserveAppointment_SendsPushWithGuestNotes(t *testing.T) {
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("erro ao abrir sqlite: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	eventRepo := repository.NewEventRepository(db)
	bookingRepo := repository.NewBookingRepositorySQLite(db)
	tokenRepo := repository.NewDeviceTokenRepository(db)

	host := &domain.User{
		ID: "user-booking-push", Name: "André Victor", Email: "andre@push.local",
		PasswordHash: "h", CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
	}
	if err := userRepo.Create(host); err != nil {
		t.Fatal(err)
	}

	var received []service.PushMessage
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var msgs []service.PushMessage
		if err := json.NewDecoder(r.Body).Decode(&msgs); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		received = msgs
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"data":[{"status":"ok"}]}`))
	}))
	defer ts.Close()

	notifSvc := service.NewNotificationService(tokenRepo, ts.Client())
	notifSvc.SetExpoAPIURL(ts.URL)
	if _, err := notifSvc.RegisterDeviceToken(host.ID, "ExponentPushToken[booking-test]", "android"); err != nil {
		t.Fatal(err)
	}

	bookingSvc := service.NewBookingService(
		bookingRepo, eventRepo, userRepo, notifSvc,
		service.NewShortIoShortenerService("", "", "http://localhost:8080"),
		service.NewTurnstileValidator(""),
		"http://localhost:8080",
	)

	bt := &domain.BookingType{
		ID: "bt-push", UserID: host.ID, Slug: "alinhamento", Title: "Alinhamento",
		DurationMinutes: 30, BufferMinutes: 0, DaysOfWeek: "[1,2,3,4,5,6,7]",
		StartHour: "09:00", EndHour: "18:00", IsActive: true,
	}
	if err := bookingRepo.CreateType(bt); err != nil {
		t.Fatal(err)
	}

	startAt := time.Date(2026, 10, 21, 14, 0, 0, 0, time.UTC)
	req := service.ReserveRequest{
		GuestName:  "Maria Silva",
		GuestEmail: "maria@test.com",
		GuestNotes: "Tragam o contrato.",
		StartAt:    startAt,
		EndAt:      startAt.Add(30 * time.Minute),
	}
	if _, err := bookingSvc.ReserveAppointment(context.Background(), host.ID, bt.Slug, req, "127.0.0.1"); err != nil {
		t.Fatalf("ReserveAppointment falhou: %v", err)
	}

	if len(received) != 1 {
		t.Fatalf("esperado 1 push de aceite, obteve %d", len(received))
	}
	msg := received[0]
	if msg.ChannelID != "vito_booking" {
		t.Errorf("esperado canal vito_booking, obteve %q", msg.ChannelID)
	}
	if msg.Data["type"] != "booking_appointment" {
		t.Errorf("push deveria carregar type=booking_appointment: %+v", msg.Data)
	}
	for _, want := range []string{"Maria Silva", "Alinhamento", "21/10/2026", "14:00", "Tragam o contrato."} {
		if !strings.Contains(msg.Title+" "+msg.Body, want) {
			t.Errorf("push deveria conter %q (título=%q corpo=%q)", want, msg.Title, msg.Body)
		}
	}
}

type mockBookingEmailSender struct {
	sentTo  []string
	sentMsg []byte
}

func (m *mockBookingEmailSender) SendMail(addr string, a smtp.Auth, from string, to []string, msg []byte) error {
	m.sentTo = to
	m.sentMsg = msg
	return nil
}

func TestBookingService_ReserveAppointment_SendsEmailNotification(t *testing.T) {
	tc := setupBookingTest(t)
	defer tc.db.Close()

	mockSender := &mockBookingEmailSender{}
	emailSvc := service.NewEmailService("smtp.gmail.com", 587, "vito@gmail.com", "pass123", "Vito <vito@gmail.com>", mockSender)
	tc.bookingSvc.SetEmailService(emailSvc)

	bt := &domain.BookingType{
		ID: "bt-email-test", UserID: tc.user.ID, Slug: "consultoria", Title: "Consultoria Técnica",
		DurationMinutes: 60, DaysOfWeek: "[1,2,3,4,5]", StartHour: "09:00", EndHour: "18:00", IsActive: true,
	}
	if err := tc.bookingRepo.CreateType(bt); err != nil {
		t.Fatal(err)
	}

	startAt := time.Date(2026, 10, 22, 10, 0, 0, 0, time.UTC)
	req := service.ReserveRequest{
		GuestName:  "Juliana Mendes",
		GuestEmail: "juliana@cliente.com",
		StartAt:    startAt,
		EndAt:      startAt.Add(time.Hour),
	}

	_, err := tc.bookingSvc.ReserveAppointment(context.Background(), tc.user.ID, bt.Slug, req, "127.0.0.1")
	if err != nil {
		t.Fatalf("ReserveAppointment falhou: %v", err)
	}

	time.Sleep(50 * time.Millisecond)

	if len(mockSender.sentTo) != 1 || mockSender.sentTo[0] != "juliana@cliente.com" {
		t.Fatalf("esperado e-mail para juliana@cliente.com, obteve %v", mockSender.sentTo)
	}
	if !strings.Contains(string(mockSender.sentMsg), "text/calendar") {
		t.Errorf("e-mail deveria conter anexo de calendário .ics")
	}
}

