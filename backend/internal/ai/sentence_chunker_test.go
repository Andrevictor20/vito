package ai

import (
	"reflect"
	"testing"
)

func TestSentenceChunker_FeedAndFlush(t *testing.T) {
	chunker := NewSentenceChunker()

	// 1. Frases simples completas
	tokens := []string{"Olá! ", "Tudo bem? ", "Tenho uma novidade para você. ", "Vamos conversar."}
	var sentences []string
	for _, tok := range tokens {
		sentences = append(sentences, chunker.Feed(tok)...)
	}
	remaining := chunker.Flush()
	if remaining != "" {
		sentences = append(sentences, remaining)
	}

	expected := []string{
		"Olá!",
		"Tudo bem?",
		"Tenho uma novidade para você.",
		"Vamos conversar.",
	}

	if !reflect.DeepEqual(sentences, expected) {
		t.Fatalf("esperava %v, obteve %v", expected, sentences)
	}
}

func TestSentenceChunker_NumbersAndAbbreviations(t *testing.T) {
	chunker := NewSentenceChunker()

	// 2. Não deve quebrar em 3.5 nem em Dr. João
	tokens := []string{"O Dr. Carlos ", "disse que o valor ", "é R$ 3.50 por unidade. ", "Entendeu?"}
	var sentences []string
	for _, tok := range tokens {
		sentences = append(sentences, chunker.Feed(tok)...)
	}
	if rem := chunker.Flush(); rem != "" {
		sentences = append(sentences, rem)
	}

	expected := []string{
		"O Dr. Carlos disse que o valor é R$ 3.50 por unidade.",
		"Entendeu?",
	}

	if !reflect.DeepEqual(sentences, expected) {
		t.Fatalf("esperava %v, obteve %v", expected, sentences)
	}
}

func TestSentenceChunker_LineBreaks(t *testing.T) {
	chunker := NewSentenceChunker()

	tokens := []string{"Linha 1\n", "Linha 2\n", "Fim."}
	var sentences []string
	for _, tok := range tokens {
		sentences = append(sentences, chunker.Feed(tok)...)
	}
	if rem := chunker.Flush(); rem != "" {
		sentences = append(sentences, rem)
	}

	expected := []string{
		"Linha 1",
		"Linha 2",
		"Fim.",
	}

	if !reflect.DeepEqual(sentences, expected) {
		t.Fatalf("esperava %v, obteve %v", expected, sentences)
	}
}
