# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🟡 Atenção (>50%) | **Última Leitura:** 2026-09-27 12:52:28  
> **Sessão:** `584bcc98-650d-4cce-b585-ea6c883c2ed7` | **Modelo Utilizado:** `Gemini 3.8 Flash` (`gemini-3.8-flash`) | **Effort:** `Medium`  
> **Limites do Modelo:** Janela de Contexto: `1.05M` (`1,048,576` tokens) | Saída Máxima: `65.5k` (`65,536` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `129.6k` tokens | `1.05M` | **12.36%** | `919.0k` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `189.0k` tokens | `800.0k` | **23.62%** | `611.0k` livres | 3 sessões (~37.8k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `5.18M` tokens | `10.00M` | **51.85%** | `4.82M` livres | 64 sessões (~740.6k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `35.8k` | 117,996 B | 27.6% |
| **Execuções de Ferramentas** | `84.3k` | 269,728 B | 65.0% |
| **Respostas & Thinking** | `8.9k` | 31,023 B | 6.8% |
| **Mensagens do Usuário** | `673` | 2,693 B | 0.5% |

---

## 3. Top Ferramentas Consumidoras
| `GENERIC` | 169 | 81.4k | 260,365 B |
| `EPHEMERAL_MESSAGE` | 10 | 2.7k | 8,795 B |
| `SYSTEM_MESSAGE` | 1 | 177 | 568 B |

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **23.6%** do teto (611.0k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **51.8%** da cota semanal (4.82M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
