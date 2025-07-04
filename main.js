// Apenas recebe e cria a api pra enviar via post

const express = require('express');
const bodyParser = require('body-parser');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

let latestQR = null;
let isClientReady = false;

// Cria uma instância do Express
const app = express();

// Middleware para analisar o corpo das requisições no formato JSON
app.use(bodyParser.json());

// Verifica se a pasta .wwebjs_auth existe, se não, cria
const authPath = path.join(__dirname, '.wwebjs_auth');
if (!fs.existsSync(authPath)) {
    fs.mkdirSync(authPath, { recursive: true });
}

// Cria uma nova instância do cliente WhatsApp com persistência
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "whatsapp-bot", // ID único para identificar a sessão
        dataPath: authPath // Caminho onde os dados da sessão serão salvos
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
        ]
    }
});

// Evento: Cliente inicializando
client.on('loading_screen', (percent, message) => {
    console.log('LOADING SCREEN', percent, message);
});

// Evento: Cliente autenticado (sessão restaurada com sucesso)
client.on('authenticated', () => {
    console.log('Cliente autenticado! Sessão restaurada.');
    latestQR = null; // Limpa o QR code pois não é mais necessário
});

// Evento: Falha na autenticação
client.on('auth_failure', msg => {
    console.error('Falha na autenticação:', msg);
});

// Evento: Cliente pronto
client.once('ready', () => {
    console.log('Client is ready!');
    isClientReady = true;
    latestQR = null; // Limpa o QR code quando estiver pronto
});

// Evento: Cliente desconectado
client.on('disconnected', (reason) => {
    console.log('Cliente desconectado:', reason);
    isClientReady = false;
});

// Evento: QR Code recebido (apenas quando não há sessão salva)
client.on('qr', qr => {
    console.log('QR Code recebido. Acesse /qr para visualizar.');
    latestQR = qr;
});

// Rota para verificar status da conexão
app.get('/status', (req, res) => {
    res.json({
        ready: isClientReady,
        hasQR: !!latestQR,
        authenticated: client.info ? true : false
    });
});

// Rota para acessar o QR Code como imagem
app.get('/qr', async (req, res) => {
    if (isClientReady) {
        return res.send(`
            <html>
            <body>
                <h1>WhatsApp já está conectado!</h1>
                <p>O cliente já está autenticado e pronto para uso.</p>
                <a href="/status">Verificar Status</a>
            </body>
            </html>
        `);
    }

    if (!latestQR) {
        return res.send(`
            <html>
            <body>
                <h1>QR Code ainda não foi gerado</h1>
                <p>O cliente ainda está inicializando. Aguarde alguns segundos e atualize a página.</p>
                <script>
                    setTimeout(() => {
                        window.location.reload();
                    }, 3000);
                </script>
            </body>
            </html>
        `);
    }

    try {
        const qrCodeImage = await QRCode.toDataURL(latestQR);
        const html = `
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>WhatsApp QR Code</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        text-align: center; 
                        padding: 20px;
                        background-color: #f0f0f0;
                    }
                    .container {
                        background: white;
                        padding: 30px;
                        border-radius: 10px;
                        display: inline-block;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    img { 
                        border: 1px solid #ddd; 
                        border-radius: 10px;
                        margin: 20px 0;
                    }
                    .refresh-btn {
                        background: #25D366;
                        color: white;
                        padding: 10px 20px;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 16px;
                        margin-top: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Escaneie o QR Code para conectar</h1>
                    <p>Abra o WhatsApp no seu celular e escaneie o código</p>
                    <img src="${qrCodeImage}" alt="QR Code" />
                    <br>
                    <button class="refresh-btn" onclick="window.location.reload()">Atualizar QR Code</button>
                    <p><small>A página será atualizada automaticamente a cada 30 segundos</small></p>
                </div>
                <script>
                    // Auto-refresh para verificar se foi conectado
                    setTimeout(() => {
                        window.location.reload();
                    }, 30000);
                </script>
            </body>
            </html>
        `;
        res.send(html);
    } catch (error) {
        res.status(500).send('Erro ao gerar QR Code: ' + error.message);
    }
});

// Rota para forçar logout (limpar sessão)
app.post('/logout', async (req, res) => {
    try {
        await client.logout();
        isClientReady = false;
        latestQR = null;
        res.json({ success: true, message: 'Logout realizado com sucesso' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao fazer logout: ' + error.message });
    }
});


// Inicializa o cliente WhatsApp
client.initialize();

// Rota para enviar mensagens
app.post('/send-message', (req, res) => {
    const { number, message } = req.body;

    if (!number || !message) {
        return res.status(400).json({ 
            success: false, 
            message: 'Número e mensagem são obrigatórios' 
        });
    }

    if (!isClientReady) {
        return res.status(503).json({ 
            success: false, 
            message: 'Cliente WhatsApp não está pronto. Verifique a conexão.' 
        });
    }

    // Formatar número (adicionar @c.us para contatos individuais, @g.us para grupos)
    //let formattedNumber = number;
    //if (!number.includes('@')) {
        //if (number.length < 14) {
            //formattedNumber = `${number}@c.us`;
        //} else {
            //formattedNumber = `${number}@g.us`;
        //}
    //}

    client.sendMessage(number, message)
    .then(() => res.status(200).send(`Mensagem enviada com sucesso`))
    .catch(err => res.status(500).send(`Numero: ${formattedNumber} Erro ao enviar mensagem: ${err}`));
});

// Rota para obter informações do cliente
app.get('/info', (req, res) => {
    if (!isClientReady) {
        return res.status(503).json({ 
            success: false, 
            message: 'Cliente não está pronto' 
        });
    }

    res.json({
        success: true,
        info: client.info
    });
});

// Middleware para tratamento de erros
app.use((error, req, res, next) => {
    console.error('Erro na aplicação:', error);
    res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor' 
    });
});

// Inicia o servidor Express
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse http://localhost:${PORT}/qr para ver o QR Code (se necessário)`);
    console.log(`Acesse http://localhost:${PORT}/status para verificar o status`);
});