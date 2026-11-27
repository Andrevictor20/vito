package calsync_test

import (
	"context"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// P1-outbound: SyncIntegration deve subir vito_booking ao Google.
func TestBugfix_SyncOutbound_IncludesVitoBooking(t *testing.T) {
	svc, eventRepo, _, userID := setupServiceTest(t)
	mockG := &mockProvider{name: domain.ProviderGoogle}
	svc.RegisterProvider(mockG)
	if _, err := svc.ConnectIntegration(context.Background(), userID, domain.ProviderGoogle, "u@gmail.com", "tok", "primary", "P"); err != nil {
		t.Fatalf("connect: %v", err)
	}
	now := time.Now().UTC().Truncate(time.Second).Add(2 * time.Hour)
	ev := &domain.Event{
		ID: "bk-1", UserID: userID, Title: "Reunião com Maria (Sync)",
		StartAt: now, EndAt: now.Add(30 * time.Minute),
		Source: "vito_booking", Category: "meeting",
		CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
	}
	if err := eventRepo.Create(ev); err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := svc.SyncIntegration(context.Background(), userID, domain.ProviderGoogle); err != nil {
		t.Fatalf("sync: %v", err)
	}
	if len(mockG.createdItems) == 0 {
		t.Fatalf("esperava outbound de vito_booking ao Google, obteve 0")
	}
}
