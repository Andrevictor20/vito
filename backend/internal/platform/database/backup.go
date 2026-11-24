package database

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// BackupMagicHeader identifica arquivos de snapshot SQLite criptografados com AES-256-GCM (v1).
const BackupMagicHeader = "VITOBKP1"

const (
	backupHKDFSalt = "vito-zero-trust-backup-salt-v1"
	backupHKDFInfo = "vito-sqlite-backup-aes256gcm-v1"
	gcmNonceSize   = 12
)

// BackupConfig define os parâmetros do gerenciador de backup criptografado.
type BackupConfig struct {
	DB         *sql.DB
	BackupDir  string
	MasterKey  string
	MaxBackups int
	Interval   time.Duration
}

// BackupManager executa snapshots quentes do SQLite (VACUUM INTO) e criptografa-os com AES-256-GCM.
type BackupManager struct {
	db         *sql.DB
	backupDir  string
	derivedKey []byte
	maxBackups int
	interval   time.Duration
	stopCh     chan struct{}
	wg         sync.WaitGroup
	mu         sync.Mutex
	running    bool
}

// deriveBackupKey implementa HKDF-SHA256 (RFC 5869) para derivar uma chave AES-256 de 32 bytes exclusiva para backups.
func deriveBackupKey(masterKey string) ([]byte, error) {
	trimmed := strings.TrimSpace(masterKey)
	if len(trimmed) < 16 {
		return nil, errors.New("master key insuficiente para derivar chave de backup (mínimo 16 caracteres)")
	}
	// HKDF-Extract(salt, IKM)
	extractor := hmac.New(sha256.New, []byte(backupHKDFSalt))
	extractor.Write([]byte(trimmed))
	prk := extractor.Sum(nil)

	// HKDF-Expand(PRK, info, 32)
	expander := hmac.New(sha256.New, prk)
	expander.Write([]byte(backupHKDFInfo))
	expander.Write([]byte{0x01})
	okm := expander.Sum(nil)
	return okm[:32], nil
}

// NewBackupManager valida a configuração e prepara o diretório seguro de backups.
func NewBackupManager(cfg BackupConfig) (*BackupManager, error) {
	if cfg.DB == nil {
		return nil, errors.New("instância sql.DB obrigatória para BackupManager")
	}
	if strings.TrimSpace(cfg.BackupDir) == "" {
		return nil, errors.New("diretório de backup obrigatório")
	}
	key, err := deriveBackupKey(cfg.MasterKey)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(cfg.BackupDir, 0700); err != nil {
		return nil, fmt.Errorf("falha ao criar diretório de backups: %w", err)
	}
	maxBackups := cfg.MaxBackups
	if maxBackups <= 0 {
		maxBackups = 7
	}
	interval := cfg.Interval
	if interval <= 0 {
		interval = 6 * time.Hour
	}

	return &BackupManager{
		db:         cfg.DB,
		backupDir:  cfg.BackupDir,
		derivedKey: key,
		maxBackups: maxBackups,
		interval:   interval,
		stopCh:     make(chan struct{}),
	}, nil
}

// CreateEncryptedSnapshot gera um snapshot consistente do SQLite via VACUUM INTO,
// criptografa o arquivo com AES-256-GCM e aplica rotação dos backups antigos.
func (m *BackupManager) CreateEncryptedSnapshot(ctx context.Context) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now().UTC()
	stamp := fmt.Sprintf("%s-%09d", now.Format("20060102-150405"), now.Nanosecond())
	tmpPlain := filepath.Join(m.backupDir, fmt.Sprintf(".tmp-snapshot-%s.db", stamp))
	defer func() {
		_ = os.Remove(tmpPlain)
	}()

	// Escapa aspas simples no caminho para VACUUM INTO seguro
	escapedPath := strings.ReplaceAll(tmpPlain, "'", "''")
	vacuumSQL := fmt.Sprintf("VACUUM INTO '%s';", escapedPath)
	if err := WithBusyRetry(5, func() error {
		_, execErr := m.db.ExecContext(ctx, vacuumSQL)
		return execErr
	}); err != nil {
		return "", fmt.Errorf("falha no VACUUM INTO do snapshot: %w", err)
	}

	plainBytes, err := os.ReadFile(tmpPlain)
	if err != nil {
		return "", fmt.Errorf("falha ao ler snapshot temporário: %w", err)
	}
	_ = os.Remove(tmpPlain)

	block, err := aes.NewCipher(m.derivedKey)
	if err != nil {
		return "", fmt.Errorf("falha ao inicializar cifra AES-256: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("falha ao inicializar GCM: %w", err)
	}

	nonce := make([]byte, gcmNonceSize)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("falha ao gerar nonce criptográfico: %w", err)
	}

	ciphertext := gcm.Seal(nil, nonce, plainBytes, []byte(BackupMagicHeader))

	outBuf := make([]byte, 0, len(BackupMagicHeader)+len(nonce)+len(ciphertext))
	outBuf = append(outBuf, []byte(BackupMagicHeader)...)
	outBuf = append(outBuf, nonce...)
	outBuf = append(outBuf, ciphertext...)

	encFilename := fmt.Sprintf("vito-backup-%s.db.enc", stamp)
	encPath := filepath.Join(m.backupDir, encFilename)
	if err := os.WriteFile(encPath, outBuf, 0600); err != nil {
		return "", fmt.Errorf("falha ao gravar backup criptografado: %w", err)
	}

	if err := m.pruneOldBackups(); err != nil {
		log.Printf("⚠️ [BackupManager] Aviso ao rotacionar backups antigos: %v", err)
	}

	return encPath, nil
}

// InvalidateSnapshots apaga TODOS os snapshots criptografados.
//
// Usado quando o usuário apaga dados que não podem sobreviver em cópia
// (ex.: "Limpar histórico" do WhatsApp): como o backup é de arquivo, as cópias
// criptografadas continuariam contendo as mensagens apagadas. Destroying-as
// é a única forma de a promessa de privacidade valer — o próximo snapshot
// (a cada 6 h) recria o ponto de recuperação com os dados já removidos.
func (m *BackupManager) InvalidateSnapshots() (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	entries, err := os.ReadDir(m.backupDir)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}

	removed := 0
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".db.enc") {
			continue
		}
		if err := os.Remove(filepath.Join(m.backupDir, entry.Name())); err != nil {
			log.Printf("⚠️ [BackupManager] falha ao invalidar snapshot %s: %v", entry.Name(), err)
			continue
		}
		removed++
	}
	return removed, nil
}

func (m *BackupManager) pruneOldBackups() error {
	entries, err := os.ReadDir(m.backupDir)
	if err != nil {
		return err
	}
	var files []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".db.enc") {
			files = append(files, filepath.Join(m.backupDir, entry.Name()))
		}
	}
	sort.Strings(files)
	if len(files) <= m.maxBackups {
		return nil
	}
	toRemove := files[:len(files)-m.maxBackups]
	for _, f := range toRemove {
		_ = os.Remove(f)
	}
	return nil
}

// DecryptSnapshot autentica e descriptografa um snapshot `.db.enc` gerado pelo BackupManager.
func DecryptSnapshot(encryptedPath string, masterKey string) ([]byte, error) {
	key, err := deriveBackupKey(masterKey)
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(encryptedPath)
	if err != nil {
		return nil, err
	}
	headerLen := len(BackupMagicHeader)
	if len(data) < headerLen+gcmNonceSize+16 {
		return nil, errors.New("arquivo de backup corrompido ou truncado")
	}
	if string(data[:headerLen]) != BackupMagicHeader {
		return nil, errors.New("cabeçalho mágico de backup inválido")
	}
	nonce := data[headerLen : headerLen+gcmNonceSize]
	ciphertext := data[headerLen+gcmNonceSize:]

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertext, []byte(BackupMagicHeader))
	if err != nil {
		return nil, fmt.Errorf("falha na verificação de autenticidade AES-256-GCM do backup: %w", err)
	}
	return plaintext, nil
}

// Start inicia o worker periódico de backup criptografado em background.
func (m *BackupManager) Start() {
	m.mu.Lock()
	if m.running {
		m.mu.Unlock()
		return
	}
	m.running = true
	m.mu.Unlock()

	m.wg.Add(1)
	go func() {
		defer m.wg.Done()
		ticker := time.NewTicker(m.interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
				if path, err := m.CreateEncryptedSnapshot(ctx); err != nil {
					log.Printf("⚠️ [BackupWorker] Falha no backup periódico: %v", err)
				} else {
					log.Printf("🔒 [BackupWorker] Snapshot AES-256-GCM gravado: %s", filepath.Base(path))
				}
				cancel()
			case <-m.stopCh:
				return
			}
		}
	}()
}

// Stop encerra o worker de backup criptografado graciosamente.
func (m *BackupManager) Stop() {
	m.mu.Lock()
	if !m.running {
		m.mu.Unlock()
		return
	}
	m.running = false
	close(m.stopCh)
	m.mu.Unlock()

	m.wg.Wait()
}
