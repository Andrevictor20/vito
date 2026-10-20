package domain_test

import (
	"testing"

	"github.com/andrevmp/vito/backend/internal/domain"
)

func TestNormalizePhone(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"e164 com mais", "+5511999998888", "+5511999998888"},
		{"e164 com 9 digitos", "+5598984417165", "+5598984417165"},
		{"digitos com ddi", "5511999998888", "+5511999998888"},
		{"digitos com ddi e 9 digitos", "5598984417165", "+5598984417165"},
		{"nacional com ddd", "11999998888", "+5511999998888"},
		{"nacional com ddd e 9 digitos", "98984417165", "+5598984417165"},
		{"nacional com zero a esquerda", "011999998888", "+5511999998888"},
		{"com pontuacao", "+55 (11) 99999-8888", "+5511999998888"},
		{"vazio", "", ""},
		{"invalido", "123", ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := domain.NormalizePhone(tc.in); got != tc.want {
				t.Errorf("NormalizePhone(%q) = %q, esperava %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestPhoneDigits(t *testing.T) {
	if got := domain.PhoneDigits("+55 (11) 99999-8888"); got != "5511999998888" {
		t.Errorf("PhoneDigits = %q, esperava 5511999998888", got)
	}
	if got := domain.PhoneDigits(""); got != "" {
		t.Errorf("PhoneDigits vazio = %q, esperava string vazia", got)
	}
}

func TestPhonesMatch(t *testing.T) {
	cases := []struct {
		name string
		a    string
		b    string
		want bool
	}{
		{"igual", "+5511999998888", "+5511999998888", true},
		{"com e sem mais", "5598984417165", "+5598984417165", true},
		{"com pontuacao", "+55 (98) 98441-7165", "+5598984417165", true},
		{"variacao do 9o digito", "559884417165", "+5598984417165", true},
		{"variacao do 9o digito invertida", "+5598984417165", "559884417165", true},
		{"nacionais equivalentes", "11999998888", "+5511999998888", true},
		{"telefones diferentes", "+5511999998888", "+5511888887777", false},
		{"vazio", "", "+5511999998888", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := domain.PhonesMatch(tc.a, tc.b); got != tc.want {
				t.Errorf("PhonesMatch(%q, %q) = %v, esperava %v", tc.a, tc.b, got, tc.want)
			}
		})
	}
}

func TestPhoneVariants(t *testing.T) {
	variants := domain.PhoneVariants("+5598984417165")

	found := map[string]bool{}
	for _, v := range variants {
		found[v] = true
	}
	for _, want := range []string{"+5598984417165", "5598984417165", "+559884417165", "559884417165"} {
		if !found[want] {
			t.Errorf("PhoneVariants não continha %q: %v", want, variants)
		}
	}
}
