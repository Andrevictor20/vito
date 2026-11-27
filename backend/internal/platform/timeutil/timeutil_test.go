package timeutil_test

import (
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/platform/timeutil"
)

func TestParseFlexibleDateTime_SaoPauloAndNaturalFormats(t *testing.T) {
	spLoc := timeutil.SaoPauloLocation()

	tests := []struct {
		name     string
		input    string
		wantHour int
		wantMin  int
		wantZero bool
	}{
		{
			name:     "ISO sem segundos usa fuso de Sao Paulo",
			input:    "2026-11-05T15:30",
			wantHour: 15,
			wantMin:  30,
		},
		{
			name:     "Formato espaco sem segundos YYYY-MM-DD HH:MM",
			input:    "2026-11-05 14:15",
			wantHour: 14,
			wantMin:  15,
		},
		{
			name:     "Formato brasileiro DD/MM/YYYY HH:MM",
			input:    "05/11/2026 09:45",
			wantHour: 9,
			wantMin:  45,
		},
		{
			name:     "Formato brasileiro com as DD/MM/YYYY às HHhMM",
			input:    "05/11/2026 às 16h30",
			wantHour: 16,
			wantMin:  30,
		},
		{
			name:     "Expressao natural amanha as 15h",
			input:    "amanhã às 15:00",
			wantHour: 15,
			wantMin:  0,
		},
		{
			name:     "Expressao natural hoje as 18h30",
			input:    "hoje 18:30",
			wantHour: 18,
			wantMin:  30,
		},
		{
			name:     "Vazio retorna zero",
			input:    "   ",
			wantZero: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := timeutil.ParseFlexibleDateTime(tc.input)
			if tc.wantZero {
				if !got.IsZero() {
					t.Fatalf("esperava zero time para %q, obteve %v", tc.input, got)
				}
				return
			}
			if got.IsZero() {
				t.Fatalf("ParseFlexibleDateTime(%q) retornou zero time", tc.input)
			}
			gotInSP := got.In(spLoc)
			if gotInSP.Hour() != tc.wantHour || gotInSP.Minute() != tc.wantMin {
				t.Errorf("ParseFlexibleDateTime(%q) em SP = %02d:%02d, esperava %02d:%02d (full=%v)",
					tc.input, gotInSP.Hour(), gotInSP.Minute(), tc.wantHour, tc.wantMin, got)
			}
			_, offset := got.Zone()
			if offset != -3*3600 {
				t.Errorf("ParseFlexibleDateTime(%q) deveria usar offset -03:00 (America/Sao_Paulo), obteve offset=%d", tc.input, offset)
			}
		})
	}
}

func TestParseDBTimeAndZeroSemantics(t *testing.T) {
	if got := timeutil.ParseDBTimeZero(nil); !got.IsZero() {
		t.Fatalf("ParseDBTimeZero(nil) deveria ser zero, obteve %v", got)
	}
	if got := timeutil.ParseDBTimeZero(""); !got.IsZero() {
		t.Fatalf("ParseDBTimeZero(vazio) deveria ser zero, obteve %v", got)
	}
	if got := timeutil.ParseDBTime(nil); got.IsZero() {
		t.Fatalf("ParseDBTime(nil) não deveria ser zero (fallback time.Now().UTC())")
	}

	parsed := timeutil.ParseDBTimeZero("2026-11-05 15:04:05")
	if parsed.Year() != 2026 || parsed.Month() != time.November || parsed.Day() != 5 || parsed.Location() != time.UTC {
		t.Fatalf("ParseDBTimeZero inesperado: %v", parsed)
	}
	if timeutil.TimeValUTC(nil) != nil {
		t.Fatalf("TimeValUTC(nil) deveria retornar nil")
	}
	zero := time.Time{}
	if timeutil.TimeValUTC(&zero) != nil {
		t.Fatalf("TimeValUTC(&zero) deveria retornar nil")
	}
	if timeutil.WeekdayPT(time.Monday) != "Segunda-feira" || timeutil.WeekdayPTLower(time.Monday) != "segunda-feira" {
		t.Fatalf("WeekdayPT inesperado")
	}
}
