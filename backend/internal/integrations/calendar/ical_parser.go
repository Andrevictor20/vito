package calendar

import (
	"bufio"
	"fmt"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

const icalDateTimeLayout = "20060102T150405Z"
const icalDateOnlyLayout = "20060102"

// FormatEventToICal converte um domain.Event em payload iCalendar RFC 5545 (VCALENDAR com VEVENT).
func FormatEventToICal(event *domain.Event, uid string) string {
	nowUTC := time.Now().UTC().Format(icalDateTimeLayout)
	startUTC := event.StartAt.UTC().Format(icalDateTimeLayout)
	endUTC := event.EndAt.UTC().Format(icalDateTimeLayout)

	var sb strings.Builder
	sb.WriteString("BEGIN:VCALENDAR\r\n")
	sb.WriteString("VERSION:2.0\r\n")
	sb.WriteString("PRODID:-//Vito Executive Assistant//PT-BR\r\n")
	sb.WriteString("CALSCALE:GREGORIAN\r\n")
	sb.WriteString("BEGIN:VEVENT\r\n")
	sb.WriteString(fmt.Sprintf("UID:%s\r\n", uid))
	sb.WriteString(fmt.Sprintf("DTSTAMP:%s\r\n", nowUTC))
	sb.WriteString(fmt.Sprintf("DTSTART:%s\r\n", startUTC))
	sb.WriteString(fmt.Sprintf("DTEND:%s\r\n", endUTC))
	sb.WriteString(fmt.Sprintf("SUMMARY:%s\r\n", sanitizeICalText(event.Title)))

	if event.Description != "" {
		sb.WriteString(fmt.Sprintf("DESCRIPTION:%s\r\n", sanitizeICalText(event.Description)))
	}
	if event.Location != "" {
		sb.WriteString(fmt.Sprintf("LOCATION:%s\r\n", sanitizeICalText(event.Location)))
	}

	sb.WriteString("STATUS:CONFIRMED\r\n")
	sb.WriteString("END:VEVENT\r\n")
	sb.WriteString("END:VCALENDAR\r\n")

	return sb.String()
}

func sanitizeICalText(text string) string {
	text = strings.ReplaceAll(text, "\\", "\\\\")
	text = strings.ReplaceAll(text, ";", "\\;")
	text = strings.ReplaceAll(text, ",", "\\,")
	text = strings.ReplaceAll(text, "\n", "\\n")
	return text
}

func parseICalDate(val string) (time.Time, bool) {
	val = strings.TrimSpace(val)
	// Trata casos com parâmetros antes dos dois pontos (ex: DTSTART;TZID=...:20261006T090000Z)
	if idx := strings.LastIndex(val, ":"); idx != -1 {
		val = val[idx+1:]
	}

	if t, err := time.Parse(icalDateTimeLayout, val); err == nil {
		return t, false
	}
	if t, err := time.Parse("20060102T150405", val); err == nil {
		return t.UTC(), false
	}
	if t, err := time.Parse(icalDateOnlyLayout, val); err == nil {
		return t.UTC(), true
	}
	return time.Time{}, false
}

// ParseICalToSyncItems converte um payload VCALENDAR em uma lista de SyncItems normalizados.
func ParseICalToSyncItems(icalData string) ([]SyncItem, error) {
	scanner := bufio.NewScanner(strings.NewReader(icalData))
	var lines []string

	// Desdobramento de linhas de continuação RFC 5545 (linhas iniciadas com espaço ou tab)
	for scanner.Scan() {
		line := scanner.Text()
		line = strings.TrimRight(line, "\r")
		if (strings.HasPrefix(line, " ") || strings.HasPrefix(line, "\t")) && len(lines) > 0 {
			lines[len(lines)-1] += strings.TrimLeft(line, " \t")
		} else if strings.TrimSpace(line) != "" {
			lines = append(lines, line)
		}
	}

	var items []SyncItem
	var current *SyncItem
	inEvent := false

	for _, line := range lines {
		upper := strings.ToUpper(strings.TrimSpace(line))
		if upper == "BEGIN:VEVENT" {
			inEvent = true
			current = &SyncItem{Status: "confirmed"}
			continue
		}
		if upper == "END:VEVENT" {
			if current != nil && current.ExternalID != "" {
				items = append(items, *current)
			}
			inEvent = false
			current = nil
			continue
		}

		if !inEvent || current == nil {
			continue
		}

		colonIdx := strings.Index(line, ":")
		if colonIdx == -1 {
			continue
		}

		keyPart := strings.ToUpper(line[:colonIdx])
		valPart := line[colonIdx+1:]

		// Extrai a tag base antes de eventuais parâmetros ';'
		tagName := keyPart
		if semiIdx := strings.Index(keyPart, ";"); semiIdx != -1 {
			tagName = keyPart[:semiIdx]
		}

		switch tagName {
		case "UID":
			current.ExternalID = strings.TrimSpace(valPart)
		case "SUMMARY":
			current.Title = unescapeICalText(valPart)
		case "DESCRIPTION":
			current.Description = unescapeICalText(valPart)
		case "LOCATION":
			current.Location = unescapeICalText(valPart)
		case "STATUS":
			current.Status = strings.ToLower(strings.TrimSpace(valPart))
		case "DTSTART":
			t, isAllDay := parseICalDate(line)
			current.StartAt = t
			current.IsAllDay = isAllDay
		case "DTEND":
			t, _ := parseICalDate(line)
			current.EndAt = t
		}
	}

	return items, nil
}

func unescapeICalText(text string) string {
	text = strings.ReplaceAll(text, "\\n", "\n")
	text = strings.ReplaceAll(text, "\\,", ",")
	text = strings.ReplaceAll(text, "\\;", ";")
	text = strings.ReplaceAll(text, "\\\\", "\\")
	return strings.TrimSpace(text)
}
