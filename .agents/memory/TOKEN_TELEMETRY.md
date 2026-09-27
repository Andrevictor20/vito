# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🟡 Atenção (>50%) | **Última Leitura:** 2026-09-26 22:36:54  
> **Sessão:** `803890b3-c25a-4657-b491-3a9d66e4b030` | **Modelo Utilizado:** `Gemini 3.8 Flash` (`gemini-3.8-flash`) | **Effort:** `Medium`  
> **Limites do Modelo:** Janela de Contexto: `1.05M` (`1,048,576` tokens) | Saída Máxima: `65.5k` (`65,536` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `266.7k` tokens | `1.05M` | **25.44%** | `781.9k` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `591.8k` tokens | `800.0k` | **73.98%** | `208.2k` livres | 5 sessões (~118.4k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `4.93M` tokens | `10.00M` | **49.32%** | `5.07M` livres | 61 sessões (~704.5k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `35.8k` | 117,996 B | 13.4% |
| **Execuções de Ferramentas** | `200.1k` | 640,205 B | 75.0% |
| **Respostas & Thinking** | `28.2k` | 98,591 B | 10.6% |
| **Mensagens do Usuário** | `2.7k` | 10,931 B | 1.0% |

---

## 3. Top Ferramentas Consumidoras
| `GENERIC` | 438 | 182.1k | 582,784 B |
| `SYSTEM_MESSAGE` | 17 | 9.8k | 31,361 B |
| `EPHEMERAL_MESSAGE` | 30 | 8.1k | 26,060 B |

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **74.0%** do teto (208.2k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **49.3%** da cota semanal (5.07M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
