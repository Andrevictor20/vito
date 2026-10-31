package toolsets

import (
	"testing"
	"time"
)

func TestParseFlexibleDateTime_SaoPauloAndNaturalFormats(t *testing.T) {
	spLoc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		spLoc = time.FixedZone("BRT", -3*3600)
	}

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
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := parseFlexibleDateTime(tc.input)
			if tc.wantZero {
				if !got.IsZero() {
					t.Fatalf("esperava zero time para %q, obteve %v", tc.input, got)
				}
				return
			}
			if got.IsZero() {
				t.Fatalf("parseFlexibleDateTime(%q) retornou zero time", tc.input)
			}
			gotInSP := got.In(spLoc)
			if gotInSP.Hour() != tc.wantHour || gotInSP.Minute() != tc.wantMin {
				t.Errorf("parseFlexibleDateTime(%q) em SP = %02d:%02d, esperava %02d:%02d (full=%v)",
					tc.input, gotInSP.Hour(), gotInSP.Minute(), tc.wantHour, tc.wantMin, got)
			}
			_, offset := got.Zone()
			if offset != -3*3600 {
				t.Errorf("parseFlexibleDateTime(%q) deveria usar offset -03:00 (America/Sao_Paulo), obteve offset=%d", tc.input, offset)
			}
		})
	}
}
