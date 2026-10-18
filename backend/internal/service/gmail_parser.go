package service

import (
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

var (
	billKeywordRegex = regexp.MustCompile(`(?i)(fatura|boleto|vencimento|mensalidade|conta|pagamento|fechamento)`)
	amountRegex      = regexp.MustCompile(`(?i)(?:R\$\s*|valor:\s*)([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})`)
	barcodeRegex     = regexp.MustCompile(`([0-9]{5}[\.\s]?[0-9]{5}[\.\s]?[0-9]{5}[\.\s]?[0-9]{6}[\.\s]?[0-9]{5}[\.\s]?[0-9]{6}[\.\s]?[0-9][\.\s]?[0-9]{14}|[0-9]{47,48}|[0-9]{44})`)
	dueDateRegex     = regexp.MustCompile(`(?i)(?:vencimento|vence em|vencendo em|data de vencimento)[:\s]*([0-9]{1,2}[/\.-][0-9]{1,2}[/\.-][0-9]{2,4})`)

	flightKeywordRegex = regexp.MustCompile(`(?i)(voo|reserva de voo|localizador|e-ticket|confirmação de voo|embarque|latam|gol|azul|boarding pass)`)
	bookingCodeRegex   = regexp.MustCompile(`(?i)(?:localizador|código da reserva|reserva|booking code)[:\s]*([A-Z0-9]{6})`)
	airportRegex       = regexp.MustCompile(`\b(GRU|CGH|SDU|GIG|BSB|CNF|SSA|REC|POA|CWB|FOR|FLN|VCP)\b`)
)

func extractHeaders(headers []struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}) (subject, from, date string) {
	for _, h := range headers {
		switch strings.ToLower(h.Name) {
		case "subject":
			subject = h.Value
		case "from":
			from = h.Value
		case "date":
			date = h.Value
		}
	}
	return
}

func parseBill(msgID, subject, from, text string) *domain.ScannedBill {
	if !billKeywordRegex.MatchString(text) {
		return nil
	}

	bill := &domain.ScannedBill{
		MessageID: msgID,
		Subject:   subject,
	}

	// Beneficiário
	if from != "" {
		bill.Beneficiary = strings.Split(from, "<")[0]
		bill.Beneficiary = strings.TrimSpace(bill.Beneficiary)
	}

	// Valor R$
	if m := amountRegex.FindStringSubmatch(text); len(m) > 1 {
		rawVal := strings.ReplaceAll(m[1], ".", "")
		rawVal = strings.ReplaceAll(rawVal, ",", ".")
		if val, err := strconv.ParseFloat(rawVal, 64); err == nil {
			bill.AmountBRL = val
		}
	}

	// Linha digitável / Código de barras
	if m := barcodeRegex.FindStringSubmatch(text); len(m) > 1 {
		bill.Barcode = strings.ReplaceAll(strings.ReplaceAll(m[1], " ", ""), ".", "")
	}

	// Data de vencimento
	if m := dueDateRegex.FindStringSubmatch(text); len(m) > 1 {
		dateStr := strings.ReplaceAll(m[1], "-", "/")
		dateStr = strings.ReplaceAll(dateStr, ".", "/")
		if t, err := time.Parse("02/01/2006", dateStr); err == nil {
			bill.DueDate = &t
		}
	}

	return bill
}

func parseFlight(msgID, subject, from, text string) *domain.ScannedFlight {
	if !flightKeywordRegex.MatchString(text) {
		return nil
	}

	flight := &domain.ScannedFlight{
		MessageID: msgID,
		Subject:   subject,
	}

	// Localizador
	if m := bookingCodeRegex.FindStringSubmatch(text); len(m) > 1 {
		flight.BookingCode = strings.ToUpper(m[1])
	} else {
		// Fallback se encontrar qualquer código isolado de 6 caracteres alfanuméricos
		reExact := regexp.MustCompile(`\b([A-Z0-9]{6})\b`)
		if m := reExact.FindStringSubmatch(text); len(m) > 1 {
			flight.BookingCode = m[1]
		}
	}

	// Aeroportos de origem e destino
	airports := airportRegex.FindAllString(text, -1)
	if len(airports) >= 2 {
		flight.Origin = airports[0]
		flight.Destination = airports[1]
	} else if len(airports) == 1 {
		flight.Origin = airports[0]
	}

	// Companhia Aérea
	lower := strings.ToLower(text)
	if strings.Contains(lower, "latam") {
		flight.Airline = "LATAM Airlines"
	} else if strings.Contains(lower, "gol") {
		flight.Airline = "GOL Linhas Aéreas"
	} else if strings.Contains(lower, "azul") {
		flight.Airline = "Azul Linhas Aéreas"
	} else {
		flight.Airline = "Companhia Aérea"
	}

	return flight
}
