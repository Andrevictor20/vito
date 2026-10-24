package handler

import (
	"encoding/binary"
	"testing"
)

func TestCalculateRMS16Bit_Silence(t *testing.T) {
	silence := make([]byte, 1024)
	rms := CalculateRMS16Bit(silence)
	if rms != 0 {
		t.Errorf("esperava RMS 0 para silêncio puro, obteve %f", rms)
	}
}

func TestCalculateRMS16Bit_Signal(t *testing.T) {
	pcm := make([]byte, 100)
	for i := 0; i < len(pcm); i += 2 {
		binary.LittleEndian.PutUint16(pcm[i:i+2], 1000)
	}
	rms := CalculateRMS16Bit(pcm)
	if rms < 900 || rms > 1100 {
		t.Errorf("esperava RMS próximo de 1000, obteve %f", rms)
	}
}

func TestCalculateRMS16Bit_Empty(t *testing.T) {
	rms := CalculateRMS16Bit(nil)
	if rms != 0 {
		t.Errorf("esperava RMS 0 para slice vazio, obteve %f", rms)
	}
}
