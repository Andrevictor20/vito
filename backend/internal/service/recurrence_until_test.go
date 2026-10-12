package service

import (
	"testing"
	"time"
)

func TestOccurrencesUntil(t *testing.T) {
	loc := time.FixedZone("BRT", -3*3600)
	start := time.Date(2026, 10, 15, 9, 0, 0, 0, loc)

	cases := []struct {
		name       string
		until      string
		recurrence string
		want       int
	}{
		{"daily inclusive range 15..20", "2026-10-20", "DAILY", 6},
		{"daily same day", "2026-10-15", "DAILY", 1},
		{"weekly over three weeks", "2026-10-29", "WEEKLY", 3},
		{"weekly partial week rounds down", "2026-10-28", "WEEKLY", 2},
		{"monthly", "2026-12-15", "MONTHLY", 3},
		{"until before start falls back", "2026-10-10", "DAILY", 8},
		{"empty until falls back", "", "DAILY", 8},
		{"invalid until falls back", "20/10/2026", "DAILY", 8},
		{"daily capped at 366", "2028-10-15", "DAILY", 366},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := occurrencesUntil(start, tc.until, tc.recurrence, 8)
			if got != tc.want {
				t.Errorf("occurrencesUntil(%q, %q) = %d, want %d", tc.until, tc.recurrence, got, tc.want)
			}
		})
	}
}
