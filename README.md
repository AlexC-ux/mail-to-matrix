# mail-to-matrix

Перевод на английский язык находится ниже.

## Описание

**mail-to-matrix** — это сервис, который автоматически проверяет почту через IMAP и пересылает новые письма в Matrix комнату.

## Возможности

- Автоматическая проверка входящих писем по расписанию
- Фильтрация писем по критериям (от кого, в теме, в теле)
- Отправка писем в Matrix комнату в форматированном виде
- Пометка прочитанных писем как `Seen` в почте
- Поддержка end-to-end шифрования в Matrix
- Отправка уведомлений в виде notices (менее заметный стиль)

## Требования

- Node.js = 22.22.0
- Аккаунт на Matrix сервере
- Почтовый ящик с включенным IMAP доступом
- Токен доступа для Matrix

## Установка

1. Клонируйте репозиторий:
```bash
git clone https://github.com/AlexC-ux/mail-to-matrix.git
cd mail-to-matrix
```

2. Установите зависимости:
```bash
npm install
```

3. Создайте файл `.env` на основе примера:
```bash
copy .env.example .env
```

4. Отредактируйте `.env` и укажите ваши данные:
```env
# Email настройки
EMAIL_HOST_IMAP=imap.yourmail.com
EMAIL_USERNAME=your@email.com
EMAIL_PORT_IMAP=993
EMAIL_PASSWORD=your_app_password
EMAIL_IMAP_SECURE=true

# Matrix настройки
MATRIX_SERVER_URL=https://matrix.org
MATRIX_ACCESS_TOKEN=your_matrix_token
MATRIX_USERID=@yourusername:matrix.org
MATRIX_RECEIVE_ROOM_ID=!roomid:matrix.org
```

## Конфигурация

Переменные окружения (см. `.env.example` для подробного описания):

### Email (IMAP)
| Переменная | Описание | Пример |
|-----------|----------|--------|
| `EMAIL_HOST_IMAP` | Адрес IMAP сервера | `imap.gmail.com` |
| `EMAIL_USERNAME` | Логин/адрес почты | `user@gmail.com` |
| `EMAIL_PORT_IMAP` | Порт IMAP (обычно 993) | `993` |
| `EMAIL_PASSWORD` | Пароль или app password | `your_password` |
| `EMAIL_IMAP_SECURE` | Использовать TLS | `true` |
| `EMAIL_FILTER` | Фильтр для поиска писем | `"from:boss@company.com"` |

### Matrix
| Переменная | Описание | Пример |
|-----------|----------|--------|
| `MATRIX_SERVER_URL` | URL Matrix сервера | `https://matrix.org` |
| `MATRIX_ACCESS_TOKEN` | Токен доступа Matrix | `@token:...` |
| `MATRIX_USERID` | Ваш Matrix ID | `@user:matrix.org` |
| `MATRIX_RECEIVE_ROOM_ID` | ID комнаты для сообщений | `!roomid:matrix.org` |
| `MATRIX_USE_ENCTYPTION` | Включить шифрование | `true/false` |
| `MATRIX_DEVICE_ID` | ID устройства (для шифрования) | `device123` |
| `MATRIX_MESSAGE_AS_NOTICE` | Отправлять как notice | `true/false` |

### Дополнительно
| Переменная | Описание | Пример |
|-----------|----------|--------|
| `EMAIL_RECV_INTERVAL_MS` | Интервал проверки (мс) | `15000` |

## Запуск

### В режиме разработки (с авто-перезапуском):
```bash
npm run dev
```

### В режиме продакшена:
```bash
npm run build
npm start
```

### Для проверки кода:
```bash
npm run type-check
npm run lint
```

### Запуск через Docker:

#### Сборка образа:
```bash
docker build -t mail-to-matrix:0.0.1 .
```

#### Запуск контейнера:
```bash
docker run --env-file .env mail-to-matrix:0.0.1
```

*Примечание: файл `.env` должен находиться в корне проекта и содержать все необходимые настройки.*

## Формат сообщения в Matrix

Каждое письмо отправляется в виде HTML-сообщения с горизонтальной линией:

```
------------------
🕐 <дата письма>
📨 <отправитель>
<b><тема письма></b>

<тело письма>
```

---

# mail-to-matrix

## Description

**mail-to-matrix** is a service that automatically checks email via IMAP and forwards new messages to a Matrix room.

## Features

- Scheduled automatic email checking
- Email filtering by criteria (sender, subject, body)
- Formatted email delivery to Matrix room
- Marking read emails as `Seen` in the mail server
- End-to-end encryption support in Matrix
- Sending notices (less prominent style)

## Requirements

- Node.js >= 16.0.0
- Matrix account
- Email box with IMAP access enabled
- Matrix app password (not main password)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/AlexC-ux/mail-to-matrix.git
cd mail-to-matrix
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` from example:
```bash
copy .env.example .env
```

4. Edit `.env` and set your credentials:
```env
# Email settings
EMAIL_HOST_IMAP=imap.yourmail.com
EMAIL_USERNAME=your@email.com
EMAIL_PORT_IMAP=993
EMAIL_PASSWORD=your_app_password
EMAIL_IMAP_SECURE=true

# Matrix settings
MATRIX_SERVER_URL=https://matrix.org
MATRIX_ACCESS_TOKEN=your_matrix_token
MATRIX_USERID=@yourusername:matrix.org
MATRIX_RECEIVE_ROOM_ID=!roomid:matrix.org
```

## Configuration

Environment variables (see `.env.example` for detailed description):

### Email (IMAP)
| Variable | Description | Example |
|----------|-------------|---------|
| `EMAIL_HOST_IMAP` | IMAP server address | `imap.gmail.com` |
| `EMAIL_USERNAME` | Email login/address | `user@gmail.com` |
| `EMAIL_PORT_IMAP` | IMAP port (usually 993) | `993` |
| `EMAIL_PASSWORD` | Password or app password | `your_password` |
| `EMAIL_IMAP_SECURE` | Use TLS encryption | `true` |
| `EMAIL_FILTER` | Filter for searching emails | `"from:boss@company.com"` |

### Matrix
| Variable | Description | Example |
|----------|-------------|---------|
| `MATRIX_SERVER_URL` | Matrix server URL | `https://matrix.org` |
| `MATRIX_ACCESS_TOKEN` | Matrix access token | `@token:...` |
| `MATRIX_USERID` | Your Matrix ID | `@user:matrix.org` |
| `MATRIX_RECEIVE_ROOM_ID` | Room ID for messages | `!roomid:matrix.org` |
| `MATRIX_USE_ENCTYPTION` | Enable encryption | `true/false` |
| `MATRIX_DEVICE_ID` | Device ID (for encryption) | `device123` |
| `MATRIX_MESSAGE_AS_NOTICE` | Send as notice | `true/false` |

### Additional
| Variable | Description | Example |
|----------|-------------|---------|
| `EMAIL_RECV_INTERVAL_MS` | Check interval (ms) | `15000` |

## Running

### Development mode (auto-restart):
```bash
npm run dev
```

### Production mode:
```bash
npm run build
npm start
```

### Code verification:
```bash
npm run type-check
npm run lint
```

### Running via Docker:

#### Build image:
```bash
docker build -t mail-to-matrix:0.0.1 .
```

#### Run container:
```bash
docker run --env-file .env mail-to-matrix:0.0.1
```

*Note: `.env` file must be located in the project root and contain all required settings.*

## Message format in Matrix

Each email is sent as an HTML message with a horizontal separator:

```
------------------
🕐 <email date>
📨 <sender>
<b><email subject></b>

<email body>