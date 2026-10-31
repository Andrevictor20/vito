package server

import (
	"encoding/json"
	"net/http"
)

func (s *Server) handleHealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	_ = json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"service": "vito-backend",
		"version": "v0.1.3",
		"router":  "chi/v5",
	})
}

func (s *Server) handleHomePage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Vito assistant</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="google-site-verification" content="PuSMriy69YLNFxqoXeHisikpyCA0Iw9XEKAvPY55vXM" />
</head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #18181B; background: #FFFFFF;">
  <h1>Vito assistant</h1>
  <p>Secretário Executivo com Inteligência Artificial Pessoal e Familiar self-hosted.</p>
  <p><a href="/privacy">Política de Privacidade</a> | <a href="/terms">Termos de Uso</a></p>
</body>
</html>`))
}

func (s *Server) handlePrivacyPolicy(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Política de Privacidade — Vito assistant</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: system-ui, sans-serif; max-width: 680px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #18181B; background: #FFFFFF;">
  <h1>Política de Privacidade do Vito assistant</h1>
  <p><strong>Última atualização:</strong> Outubro de 2026</p>
  <p>O <strong>Vito assistant</strong> é um assistente executivo pessoal e familiar projetado sob o princípio de <strong>privacidade total (Zero-Trust) e hospedagem própria (Self-Hosted)</strong>.</p>
  <h2>1. Coleta e Uso de Dados</h2>
  <p>O aplicativo conecta-se à sua conta Google para autenticação de identidade (Single Sign-On) e sincronização bidirecional de eventos no Google Calendar.</p>
  <h2>2. Armazenamento e Criptografia</h2>
  <p>Todos os tokens de autenticação do Google Calendar e dados de agenda são criptografados em repouso com o padrão militar <strong>AES-256-GCM</strong> e armazenados exclusivamente no seu próprio servidor local/privado.</p>
  <h2>3. Não Compartilhamento</h2>
  <p>Seus dados nunca são vendidos, compartilhados ou transferidos para terceiros nem usados para treinamento de modelos de inteligência artificial de forma não autorizada.</p>
  <h2>4. Exclusão de Dados</h2>
  <p>Você pode revogar o acesso a qualquer momento através do aplicativo na opção "Desconectar Google Calendar" ou pela página de permissões da sua Conta Google.</p>
  <p><a href="/">Voltar à Página Inicial</a></p>
</body>
</html>`))
}

func (s *Server) handleTermsOfService(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Termos de Serviço — Vito assistant</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: system-ui, sans-serif; max-width: 680px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #18181B; background: #FFFFFF;">
  <h1>Termos de Serviço do Vito assistant</h1>
  <p><strong>Última atualização:</strong> Outubro de 2026</p>
  <p>Ao utilizar o Vito assistant, você concorda com o uso da ferramenta para fins de gestão de compromissos, lembretes e tarefas pessoais.</p>
  <h2>Uso do Serviço</h2>
  <p>O serviço é fornecido no modelo self-hosted para gestão pessoal e familiar de compromissos.</p>
  <p><a href="/">Voltar à Página Inicial</a></p>
</body>
</html>`))
}
