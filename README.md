# netRush 🌉

Jogo web local em 3D que transforma **tráfego de rede real gravado** em veículos
atravessando uma ponte. Cada protocolo vira um tipo de veículo; o volume de
pacotes define quantos veículos entram na ponte; a direção do tráfego define o
sentido da travessia.

> **Modo replay apenas.** O netRush **não captura tráfego ao vivo** e **não
> depende de servidor/VPS**: tudo roda no navegador, lendo arquivos PCAP,
> PCAPNG ou datasets JSON/CSV previamente gravados.

## Como executar

O projeto é 100% estático — basta servir a pasta por HTTP (módulos ES não
funcionam via `file://`):

```bash
# qualquer um dos dois:
python3 -m http.server 8080
npx serve -l 8080 .
```

Abra `http://localhost:8080`, clique em **📁 Abrir PCAP / dataset** (ou arraste
um arquivo para a janela) e pressione **▶ Iniciar**. Sem arquivo à mão, o botão
**🎮 Demo** gera 2 minutos de tráfego sintético.

> As bibliotecas Three.js (3D) e Font Awesome (ícones da interface) são
> carregadas via CDN, então a primeira execução precisa de internet. Para uso
> 100% offline, baixe `three.module.js`, os addons e o CSS da Font Awesome e
> ajuste as referências no `index.html`.

## Formatos aceitos

| Formato | Detalhes |
|---|---|
| **PCAP** | clássico (micro e nanossegundos, LE/BE); linktypes Ethernet, Linux SLL/SLL2, RAW IP, NULL/loopback; IPv4 e IPv6; VLAN |
| **PCAPNG** | SHB/IDB/EPB/SPB, múltiplas interfaces, `if_tsresol` |
| **JSON** | array de objetos com campos flexíveis (`ts`, `src_ip`, `dst_ip`, `src_port`, `dst_port`, `protocol`, `size` e aliases comuns) |
| **CSV** | mesmas colunas, com cabeçalho; compatível com exportações do tshark (`frame.time_epoch`, `ip.src`, …) |

Exemplos prontos em [`samples/`](samples/) (gerados por
`node scripts/generate_samples.mjs`).

Exportando um CSV a partir de uma captura com tshark:

```bash
tshark -r captura.pcap -T fields -E header=y -E separator=, \
  -e frame.time_epoch -e ip.src -e ip.dst \
  -e tcp.srcport -e tcp.dstport -e _ws.col.protocol -e frame.len > dados.csv
```

## Mapeamento protocolo → veículo

| Protocolo | Veículo | Critério |
|---|---|---|
| HTTPS | 🏍️ Motocicleta | TCP porta 443 |
| QUIC | 🚌 Ônibus urbano | UDP porta 443 |
| HTTP | 🚕 Táxi | TCP porta 80/8080 |
| DNS | 🚲 Bicicleta | porta 53/5353 |
| SSH | 🚚 Caminhão baú | TCP porta 22 |
| TCP genérico | 🏎️ Carro esportivo | demais TCP |
| UDP genérico | 🚓 Carro de polícia | demais UDP |
| ICMP/ping | 🚐 Van | ICMP/ICMPv6 |
| ARP | 🚗 Sedã | ethertype ARP |
| Outros | 🚙 Carro compacto | resto |

## Como funciona

```
arquivo (PCAP/JSON/CSV)
   │  js/readers/        leitor: extrai só metadados seguros (IPs, portas,
   ▼                     protocolo, tamanho, horário — nunca payload)
pacotes brutos
   │  js/core/normalizer.js   classifica (classifier.js) e resolve direção
   ▼                          (direction.js: IP privado = lado local; empate
eventos normalizados          resolvido por quem iniciou o fluxo)
   │  js/core/aggregator.js   agrupa em janelas de 250 ms / 500 ms / 1 s
   ▼
janelas agregadas
   │  js/core/replay.js       relógio virtual com velocidade 0.5x–10x
   ▼
spawns de veículos            aggregator.vehiclesForWindow: ~50 pacotes/s por
   │  js/game/traffic.js      veículo (ajustável pela densidade), teto global,
   ▼                          mínimo ocasional p/ protocolos raros
ponte 3D (js/game/engine.js + vehicles.js) e HUD (js/ui/hud.js)
```

A agregação garante que **um pacote nunca vira um veículo diretamente**: 800
pacotes HTTPS num segundo viram ~16 motocicletas, não 800.

### Direção na ponte

- IP de origem privado (10/8, 172.16/12, 192.168/16…) e destino público →
  veículo vai da **REDE LOCAL → INTERNET** (esquerda → direita).
- Origem pública e destino privado → sentido oposto.
- Caso ambíguo → quem mandou o primeiro pacote do fluxo é tratado como cliente.

### Gameplay e ambientação

- Cenário de **anoitecer urbano**: ponte estaiada com fitas de LED, skyline
  iluminado nas duas margens, céu em gradiente com estrelas e lua, água
  animada e veículos modernos com faróis/lanternas acesos.
- Ponte cheia gera **congestionamento**: veículos desaceleram (car-following
  com trava anticolisão — um veículo nunca atravessa o outro) e o HUD avisa
  "horário de pico".
- Pacotes maiores geram veículos maiores e mais lentos.
- Fluxos presentes em 4+ janelas seguidas viram **comboios** na mesma faixa.
- Picos 3σ acima da média móvel disparam **alerta de tráfego anormal** com
  pulso de luz vermelha na cena.
- **Modo cinematográfico**: paleta neon synthwave, câmera orbitando e
  protocolos raros mais visíveis.

## Controles

- ▶/⏸/⟲ — iniciar, pausar e reiniciar o replay
- Velocidade — 0.5x, 1x, 2x, 5x, 10x
- Janela — 250 ms, 500 ms ou 1 s de agregação
- Densidade — multiplicador visual de veículos (0.2x–3x)
- Máx. veículos/s — teto absoluto de spawns
- Modo cinematográfico — liga/desliga
- Mouse — orbitar/zoom na câmera (fora do modo cinematográfico)

## Privacidade

Apenas metadados técnicos são processados: horário, IPs, portas, protocolo e
tamanho. **Nenhum payload, URL, credencial ou conteúdo de aplicação é lido,
armazenado ou exibido** — o parser inspeciona somente cabeçalhos e nada sai do
navegador.

## Desenvolvimento

```bash
node scripts/generate_samples.mjs   # regenera samples/
node scripts/test_parsers.mjs       # testa leitores, classificador e agregador
```
