package service

import (
	"strings"
	"time"
)

const maxRecurrenceOccurrences = 366

// occurrencesUntil calcula quantas ocorrências cabem entre start e a data limite (YYYY-MM-DD, inclusiva).
// Retorna fallback quando a data limite está ausente, inválida ou anterior ao início.
func occurrencesUntil(start time.Time, until, recurrence string, fallback int) int {
	if strings.TrimSpace(until) == "" {
		return fallback
	}
	untilDate, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(until), start.Location())
	if err != nil {
		return fallback
	}
	startDate := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, start.Location())
	if untilDate.Before(startDate) {
		return fallback
	}

	count := 0
	for i := 0; i < maxRecurrenceOccurrences; i++ {
		var cur time.Time
		switch strings.ToUpper(recurrence) {
		case "MONTHLY":
			cur = startDate.AddDate(0, i, 0)
		case "WEEKLY":
			cur = startDate.AddDate(0, 0, i*7)
		default:
			cur = startDate.AddDate(0, 0, i)
		}
		if cur.After(untilDate) {
			break
		}
		count++
	}
	return count
}
