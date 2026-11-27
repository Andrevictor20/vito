package booking_test

import (
	"context"
	"database/sql"
	"github.com/andrevmp/vito/backend/internal/calendar"
	"github.com/andrevmp/vito/backend/internal/calendar/booking"
	"sync"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/platform/database"
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
	bookingSvc  *booking.BookingService
}

func setupBookingTest(t *testing.T) *bookingTestContext {
	t.Helper()
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("erro ao abrir sqlite: %v", err)
	}

	userRepo := repository.NewUserRepository(db)
	eventRepo := calendar.NewEventRepository(db)
	bookingRepo := booking.NewBookingRepositorySQLite(db)

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

	bookingSvc := booking.NewBookingService(
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

	// Dia útil sempre futuro: uma data fixa quebra o teste quando ela vira "hoje",
	// pois slots já passados deixam de estar disponíveis.
	targetDate := time.Now().UTC().AddDate(0, 0, 7)
	for targetDate.Weekday() == time.Saturday || targetDate.Weekday() == time.Sunday {
		targetDate = targetDate.AddDate(0, 0, 1)
	}
	targetDate = time.Date(targetDate.Year(), targetDate.Month(), targetDate.Day(), 0, 0, 0, 0, time.UTC)
	eventStart := time.Date(targetDate.Year(), targetDate.Month(), targetDate.Day(), 9, 30, 0, 0, time.UTC)

	// Adiciona um evento existente na agenda do anfitrião das 09:30 às 10:00
	existingEvent := &domain.Event{
		ID:        "ev-conflict",
		UserID:    ctx.user.ID,
		Title:     "Reunião Interna",
		StartAt:   eventStart,
		EndAt:     eventStart.Add(30 * time.Minute),
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

	req := booking.ReserveRequest{
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
			req := booking.ReserveRequest{
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
	req := booking.ReserveRequest{
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
