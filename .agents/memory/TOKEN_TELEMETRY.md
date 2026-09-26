# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🟡 Atenção (>50%) | **Última Leitura:** 2026-09-26 20:08:11  
> **Sessão:** `ba5a0bef-eb18-43cc-a06d-c7ac404202d0` | **Modelo Utilizado:** `Gemini 3.8 Flash` (`gemini-3.8-flash`) | **Effort:** `Medium`  
> **Limites do Modelo:** Janela de Contexto: `1.05M` (`1,048,576` tokens) | Saída Máxima: `65.5k` (`65,536` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `302.2k` tokens | `1.05M` | **28.82%** | `746.3k` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `583.8k` tokens | `800.0k` | **72.97%** | `216.2k` livres | 6 sessões (~116.8k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `4.64M` tokens | `10.00M` | **46.43%** | `5.36M` livres | 59 sessões (~663.4k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `35.8k` | 117,996 B | 11.8% |
| **Execuções de Ferramentas** | `227.0k` | 726,517 B | 75.1% |
| **Respostas & Thinking** | `35.1k` | 122,967 B | 11.6% |
| **Mensagens do Usuário** | `4.3k` | 17,251 B | 1.4% |

---

## 3. Top Ferramentas Consumidoras
| `GENERIC` | 547 | 208.1k | 665,933 B |
| `SYSTEM_MESSAGE` | 22 | 9.8k | 31,479 B |
| `EPHEMERAL_MESSAGE` | 33 | 9.1k | 29,105 B |

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **73.0%** do teto (216.2k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **46.4%** da cota semanal (5.36M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
