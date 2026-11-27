package calendar_test

import (
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// P3: excluir série propaga TODOS os ids ao Google (purge total).
func TestBugfix_DeleteSeries_PropagatesAll(t *testing.T) {
	calSvc, eventRepo := setupCalendarService(t)
	pusher := &mockSyncPusher{}
	calSvc.SetSyncPusher(pusher)
	base := time.Now().UTC().Truncate(time.Second).Add(24 * time.Hour)
	for i := 0; i < 3; i++ {
		ev := &domain.Event{
			ID: "series-ev-" + string(rune('a'+i)), UserID: "user-cal-svc-1",
			Title: "Aula de Inglês", StartAt: base.Add(time.Duration(i*24) * time.Hour),
			EndAt:     base.Add(time.Duration(i*24)*time.Hour + time.Hour),
			CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
		}
		if err := eventRepo.Create(ev); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
	count, err := calSvc.DeleteEventWithOption("series-ev-a", "user-cal-svc-1", true)
	if err != nil {
		t.Fatalf("delete series: %v", err)
	}
	if count != 3 {
		t.Fatalf("esperava apagar 3 da série, apagou %d", count)
	}
	if got := len(pusher.getDeletedIDs()); got != 3 {
		t.Fatalf("esperava 3 deletes propagados ao Google, obteve %d (%v)", got, pusher.getDeletedIDs())
	}
}
