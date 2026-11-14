package service

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"
)

// InstallmentStatus distingue parcelas informadas pelo banco de parcelas inferidas.
type InstallmentStatus string

const (
	// InstallmentConfirmed: o banco já enviou a parcela (data futura ou pendente).
	InstallmentConfirmed InstallmentStatus = "CONFIRMADA"
	// InstallmentProjected: inferida a partir de número/total da última parcela vista.
	InstallmentProjected InstallmentStatus = "PROJETADA"
)

// InstallmentObservation é uma parcela vista em uma transação de cartão.
type InstallmentObservation struct {
	AccountID string
	Merchant  string
	Number    int
	Total     int
	Amount    float64 // valor positivo da parcela
	Date      time.Time
	Pending   bool
}

// InstallmentPlan agrega as observações de uma mesma compra parcelada.
type InstallmentPlan struct {
	PlanKey    string
	AccountID  string
	Merchant   string
	Count      int
	Amount     float64
	LastNumber int
	LastDate   time.Time
	Confirmed  []InstallmentEntry // parcelas futuras já enviadas pelo banco
}

// InstallmentEntry é uma parcela a vencer.
type InstallmentEntry struct {
	PlanKey   string            `json:"plan_key"`
	AccountID string            `json:"account_id"`
	Merchant  string            `json:"merchant"`
	Number    int               `json:"number"`
	Total     int               `json:"total"`
	Amount    float64           `json:"amount"`
	DueDate   time.Time         `json:"due_date"`
	Status    InstallmentStatus `json:"status"`
}

// InstallmentMonth soma as parcelas de um mês (formato "YYYY-MM").
type InstallmentMonth struct {
	Month   string             `json:"month"`
	Total   float64            `json:"total"`
	Entries []InstallmentEntry `json:"entries"`
}

// InstallmentProjection é o resultado do cálculo de compromissos futuros.
type InstallmentProjection struct {
	Months []InstallmentMonth `json:"months"`
	// TotalCommitted soma todas as parcelas a vencer, inclusive além do horizonte.
	TotalCommitted float64 `json:"total_committed"`
}

func normalizeMerchant(s string) string {
	return strings.ToLower(strings.Join(strings.Fields(s), " "))
}

func planKey(accountID, merchant string, total int, amount float64) string {
	raw := fmt.Sprintf("%s|%s|%d|%d", accountID, merchant, total, int64(math.Round(amount*100)))
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:8])
}

// BuildInstallmentPlans agrupa observações em planos, descartando compras à vista e dados inválidos.
func BuildInstallmentPlans(obs []InstallmentObservation) []InstallmentPlan {
	byKey := map[string]*InstallmentPlan{}
	for _, o := range obs {
		if o.Total < 2 || o.Number < 1 || o.Number > o.Total || o.Amount <= 0 {
			continue
		}
		m := normalizeMerchant(o.Merchant)
		key := planKey(o.AccountID, m, o.Total, o.Amount)
		p, ok := byKey[key]
		if !ok {
			p = &InstallmentPlan{PlanKey: key, AccountID: o.AccountID, Merchant: m, Count: o.Total, Amount: o.Amount}
			byKey[key] = p
		}
		if o.Number > p.LastNumber {
			p.LastNumber, p.LastDate = o.Number, o.Date
		}
	}
	plans := make([]InstallmentPlan, 0, len(byKey))
	for _, p := range byKey {
		plans = append(plans, *p)
	}
	sort.Slice(plans, func(i, j int) bool { return plans[i].PlanKey < plans[j].PlanKey })
	attachFutureObservations(plans, obs)
	return plans
}

// attachFutureObservations registra parcelas já enviadas pelo banco (pendentes/futuras).
func attachFutureObservations(plans []InstallmentPlan, obs []InstallmentObservation) {
	idx := map[string]int{}
	for i, p := range plans {
		idx[p.PlanKey] = i
	}
	for _, o := range obs {
		if o.Total < 2 || o.Number < 1 || o.Number > o.Total || o.Amount <= 0 {
			continue
		}
		i, ok := idx[planKey(o.AccountID, normalizeMerchant(o.Merchant), o.Total, o.Amount)]
		if !ok {
			continue
		}
		plans[i].Confirmed = append(plans[i].Confirmed, InstallmentEntry{
			PlanKey: plans[i].PlanKey, AccountID: o.AccountID, Merchant: plans[i].Merchant,
			Number: o.Number, Total: o.Total, Amount: o.Amount, DueDate: o.Date, Status: InstallmentConfirmed,
		})
	}
}

// addMonthsClamped soma meses preservando o dia, limitado ao último dia do mês de destino.
func addMonthsClamped(t time.Time, n int) time.Time {
	first := time.Date(t.Year(), t.Month(), 1, t.Hour(), t.Minute(), t.Second(), 0, t.Location()).AddDate(0, n, 0)
	last := time.Date(first.Year(), first.Month()+1, 0, 0, 0, 0, 0, first.Location()).Day()
	day := t.Day()
	if day > last {
		day = last
	}
	return time.Date(first.Year(), first.Month(), day, t.Hour(), t.Minute(), t.Second(), 0, t.Location())
}

// ProjectInstallments calcula os compromissos de parcelas a partir de asOf, em até `months` meses.
func ProjectInstallments(plans []InstallmentPlan, asOf time.Time, months int) InstallmentProjection {
	startMonth := time.Date(asOf.Year(), asOf.Month(), 1, 0, 0, 0, 0, asOf.Location())
	endExclusive := startMonth.AddDate(0, months, 0)
	buckets := map[string]*InstallmentMonth{}
	var committed float64

	add := func(e InstallmentEntry) {
		committed += e.Amount
		if e.DueDate.Before(startMonth) || !e.DueDate.Before(endExclusive) {
			return
		}
		key := e.DueDate.Format("2006-01")
		b, ok := buckets[key]
		if !ok {
			b = &InstallmentMonth{Month: key}
			buckets[key] = b
		}
		b.Entries = append(b.Entries, e)
		b.Total += e.Amount
	}

	for _, p := range plans {
		for _, c := range p.Confirmed {
			if c.DueDate.After(asOf) {
				add(c)
			}
		}
		for n := p.LastNumber + 1; n <= p.Count; n++ {
			add(InstallmentEntry{
				PlanKey: p.PlanKey, AccountID: p.AccountID, Merchant: p.Merchant,
				Number: n, Total: p.Count, Amount: p.Amount,
				DueDate: addMonthsClamped(p.LastDate, n-p.LastNumber), Status: InstallmentProjected,
			})
		}
	}

	out := InstallmentProjection{TotalCommitted: math.Round(committed*100) / 100}
	for _, b := range buckets {
		b.Total = math.Round(b.Total*100) / 100
		out.Months = append(out.Months, *b)
	}
	sort.Slice(out.Months, func(i, j int) bool { return out.Months[i].Month < out.Months[j].Month })
	return out
}
