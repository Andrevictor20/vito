# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🟡 Atenção (>50%) | **Última Leitura:** 2026-09-27 14:31:59  
> **Sessão:** `584bcc98-650d-4cce-b585-ea6c883c2ed7` | **Modelo Utilizado:** `Gemini 3.8 Flash` (`gemini-3.8-flash`) | **Effort:** `Medium`  
> **Limites do Modelo:** Janela de Contexto: `1.05M` (`1,048,576` tokens) | Saída Máxima: `65.5k` (`65,536` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `153.2k` tokens | `1.05M` | **14.61%** | `895.3k` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `212.6k` tokens | `800.0k` | **26.58%** | `587.4k` livres | 3 sessões (~42.5k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `5.21M` tokens | `10.00M` | **52.08%** | `4.79M` livres | 64 sessões (~744.0k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `35.8k` | 117,996 B | 23.3% |
| **Execuções de Ferramentas** | `105.8k` | 338,550 B | 69.0% |
| **Respostas & Thinking** | `10.9k` | 38,155 B | 7.1% |
| **Mensagens do Usuário** | `791` | 3,166 B | 0.5% |

---

## 3. Top Ferramentas Consumidoras
| `GENERIC` | 208 | 102.3k | 327,435 B |
| `EPHEMERAL_MESSAGE` | 12 | 3.3k | 10,547 B |
| `SYSTEM_MESSAGE` | 1 | 177 | 568 B |

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **26.6%** do teto (587.4k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **52.1%** da cota semanal (4.79M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
