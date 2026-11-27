package booking_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andrevmp/vito/backend/internal/domain"
)

func TestBookingHandler_PartialUpdateIsActivePreservesOtherFields(t *testing.T) {
	mux, _, bt := setupBookingHandlerTest(t)

	body := bytes.NewBufferString(`{"is_active":false}`)
	req := httptest.NewRequest(http.MethodPut, "/api/v1/booking/types/"+bt.ID, body)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("esperava 200 OK no patch parcial, obteve %d: %s", rr.Code, rr.Body.String())
	}

	var updated domain.BookingType
	if err := json.NewDecoder(rr.Body).Decode(&updated); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if updated.IsActive {
		t.Fatalf("esperava IsActive=false após toggle")
	}
	if updated.Slug != "30m" || updated.Title != "Alinhamento 30m" || updated.DurationMinutes != 30 || updated.StartHour != "10:00" || updated.EndHour != "18:00" {
		t.Fatalf("campos existentes foram corrompidos pelo update parcial: %+v", updated)
	}
}
