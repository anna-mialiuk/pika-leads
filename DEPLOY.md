# Деплой Pika Leads: GitHub + VPS + домен

Схема: код у GitHub → кожен `push` у гілку `main` запускає GitHub Actions →
сайт збирається (`npm run build`) → папка `dist/` копіюється на VPS → Nginx її віддає.

Домен сайту: **pika-leads.com**. У командах нижче замініть:
- `SERVER_IP` — IP вашого VPS
- `USER` — ваш логін на GitHub

---

## 1. Репозиторій на GitHub

1. На github.com → **New repository** → назва `pika-leads`, **Private**, без README.
2. У корені проєкту (перевірте, що немає зайвих папок на кшталт `components 2`):

```bash
git init
git add .
git commit -m "Pika Leads: initial commit"
git branch -M main
git remote add origin git@github.com:USER/pika-leads.git
git push -u origin main
```

Далі можна комітити й пушити з VS Code, як зазвичай.

## 2. Сервер (один раз)

Підключіться: `ssh root@SERVER_IP`

```bash
# Nginx + certbot
apt update && apt install -y nginx certbot python3-certbot-nginx rsync

# окремий користувач для деплою і папка сайту
adduser --disabled-password --gecos "" deploy
mkdir -p /var/www/pikaleads
chown -R deploy:deploy /var/www/pikaleads
```

Конфіг Nginx — файл `deploy/nginx.conf` з репозиторію (домен у ньому вже прописаний):

```bash
nano /etc/nginx/sites-available/pikaleads     # вставити вміст deploy/nginx.conf
ln -s /etc/nginx/sites-available/pikaleads /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

## 3. SSH-ключ для GitHub Actions

На **своєму комп'ютері**:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/pikaleads_deploy -N "" -C "github-actions-pikaleads"
ssh-copy-id -i ~/.ssh/pikaleads_deploy.pub deploy@SERVER_IP
cat ~/.ssh/pikaleads_deploy        # приватний ключ — для GitHub Secrets
```

## 4. Налаштування в GitHub

Репозиторій → **Settings → Secrets and variables → Actions**

**Secrets:**

| Назва | Значення |
|---|---|
| `SSH_PRIVATE_KEY` | увесь вміст `~/.ssh/pikaleads_deploy` (разом з рядками BEGIN/END) |
| `SSH_HOST` | `SERVER_IP` |
| `SSH_USER` | `deploy` |
| `DEPLOY_PATH` | `/var/www/pikaleads` |
| `LEADS_ENDPOINT` | URL для заявок (можна поки не задавати) |

**Variables** (вкладка поруч):

| Назва | Значення |
|---|---|
| `SITE_URL` | `https://pika-leads.com` |

## 5. Домен (DNS)

У панелі реєстратора домену додайте записи:

| Тип | Ім'я | Значення |
|---|---|---|
| A | `@` | `SERVER_IP` |
| A | `www` | `SERVER_IP` |

Оновлення DNS займає від кількох хвилин до кількох годин. Перевірка: `ping pika-leads.com`.

## 6. Перший деплой і HTTPS

1. GitHub → вкладка **Actions** → **Deploy** → **Run workflow** (або просто зробіть push).
2. Коли деплой зелений і DNS оновився — на сервері:

```bash
certbot --nginx -d pika-leads.com -d www.pika-leads.com
```

Certbot сам допише HTTPS у конфіг Nginx і налаштує автопродовження сертифіката.

## 7. Перевірка

- `https://pika-leads.com`, `https://pika-leads.com/en/cases`, `https://pika-leads.com/ru/blog/capi-setup` — відкриваються (і після F5 теж)
- `https://www.pika-leads.com` → редірект на `https://pika-leads.com`
- `https://pika-leads.com/sitemap.xml` і `/robots.txt` — з правильним доменом
- Google Search Console → додати домен і надіслати `sitemap.xml`

---

## Як оновлювати сайт

Комітите й пушите в `main` — через 1–2 хвилини зміни на сайті.
Якщо збірка впала (наприклад, `i18n:check` знайшов неперекладений текст) — деплою не буде,
а причину видно у вкладці **Actions**.

---

## Заявки в Telegram

Усі форми сайту надсилають заявки на `https://pika-leads.com/api/leads`.
Там працює невеликий приймач `server/leads/index.mjs`: перевіряє заявку, зберігає копію
у `leads.jsonl` і надсилає повідомлення в Telegram.

### 1. Бот і чат

> **Окремий бот для сайту.** Якщо в групі вже є бот іншої системи (наприклад, квізів) з кнопками статусу,
> не використовуйте його токен: два обробники кнопок на одному боті конфліктують, і зламаються обидва.
> Створіть нового бота (наприклад, «Pikaleads Site») і додайте його в ту саму групу —
> заявки з сайту й квізів падатимуть в один чат, кожна зі своїми кнопками.

1. У Telegram відкрийте **@BotFather** → `/newbot` → назва (наприклад, «Pika Leads Заявки») і логін бота.
   BotFather дасть **токен** виду `123456:ABC-...`.
2. Створіть групу (наприклад, «Заявки Pika Leads»), додайте туди бота й усіх, хто має бачити заявки.
   Напишіть у групі будь-яке повідомлення.
3. Відкрийте в браузері `https://api.telegram.org/botТОКЕН/getUpdates` і знайдіть `"chat":{"id":-100…}`
   — це **ID чату** (для групи він від'ємний).

### 2. Сервер (один раз, як root)

```bash
node -v    # потрібен Node 18+

mkdir -p /home/deploy/leads-server
nano /home/deploy/leads-server/.env
```

Вміст `.env`:

```
TELEGRAM_BOT_TOKEN=123456:ABC-...
TELEGRAM_CHAT_ID=-100...
PORT=3010
LEADS_FILE=/home/deploy/leads-server/leads.jsonl
```

```bash
chown -R deploy:deploy /home/deploy/leads-server
chmod 600 /home/deploy/leads-server/.env

# сервіс (вміст — файл deploy/pikaleads-leads.service з репозиторію)
nano /etc/systemd/system/pikaleads-leads.service
systemctl daemon-reload
systemctl enable pikaleads-leads

# дозвіл для автодеплою перезапускати лише цей сервіс
echo "deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart pikaleads-leads" > /etc/sudoers.d/pikaleads-leads
chmod 440 /etc/sudoers.d/pikaleads-leads
```

Nginx: у `/etc/nginx/sites-available/pikaleads`, у блок `server` з `listen 443 ssl` і `server_name pika-leads.com`,
перед `location / {` додайте:

```nginx
    location /api/leads {
        proxy_pass http://127.0.0.1:3010;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        client_max_body_size 32k;
    }
```

```bash
nginx -t && systemctl reload nginx
```

### 3. Деплой і перевірка

Push у `main` — автодеплой скопіює код приймача в `/home/deploy/leads-server` і перезапустить сервіс.

```bash
curl https://pika-leads.com/api/leads/health      # {"ok":true}
systemctl status pikaleads-leads                  # active (running)
journalctl -u pikaleads-leads -n 50               # лог, якщо щось не так
```

Надішліть тестову заявку з сайту — у групі має з'явитися повідомлення з ім'ям, телефоном (клікабельний),
нішею, сторінкою, мовою, UTM-мітками й кнопками статусу («Идём на звонок», «Квалифицирован», «Продажа»…).
Натискання кнопки змінює рядок «Статус лида: … · хто натиснув».

**UTM для реклами Meta**, щоб у заявці заповнились Кампания / Ключ / Место размещения / ID:

```
utm_source=roma&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&placement={{placement}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}
```

**Захист від спаму:** приховане поле-пастка в кожній формі й не більше 5 заявок з однієї IP за 10 хвилин.
**Резервна копія:** усі заявки (навіть якщо Telegram недоступний) — у `/home/deploy/leads-server/leads.jsonl`.

---

## Адмінка app.pika-leads.com (CRM заявок)

Адмінка — окремий застосунок у папці `admin/`. Бекенд — той самий приймач заявок `server/leads`
(API `/api/admin/*`). Дані зберігаються на сервері поруч із журналом заявок:

| Файл | Що в ньому |
|---|---|
| `leads.jsonl` | журнал усіх заявок (як і раніше, рядок на заявку) |
| `leads.json` | CRM: статуси, менеджери, коментарі, історія |
| `users.json` | співробітники (паролі — лише scrypt-хеші, 2FA-ключі) |
| `secret.key` | ключ підпису сесій (генерується сам) |

При першому запуску нової версії всі заявки з `leads.jsonl` автоматично переносяться в CRM,
а статуси з уже натиснутих кнопок у Telegram підтягуються зі старих повідомлень.

> **Порядок важливий:** спершу кроки 1–2 (DNS і сервер), потім push коду. Інакше крок
> «Upload admin» у GitHub Actions впаде, бо на сервері ще немає папки `/var/www/pikaleads-admin`.

### 1. DNS (Cloudflare)

DNS → Records → **Add record**: тип `A`, ім'я `app`, IPv4 `173.242.63.233`, **DNS only** (сіра хмаринка).

### 2. Сервер (як root)

```bash
# папка для файлів адмінки
mkdir -p /var/www/pikaleads-admin
chown deploy:deploy /var/www/pikaleads-admin

# конфіг Nginx — вміст файлу deploy/nginx-admin.conf з репозиторію
nano /etc/nginx/sites-available/pikaleads-admin
ln -s /etc/nginx/sites-available/pikaleads-admin /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# HTTPS (коли DNS уже оновився: dig +short app.pika-leads.com → 173.242.63.233)
certbot --nginx -d app.pika-leads.com
```

### 3. Код

Push у `main` — GitHub Actions збере сайт і адмінку, скопіює їх на сервер, оновить приймач і перезапустить сервіс.

Перевірка:

```bash
journalctl -u pikaleads-leads -n 20 --no-pager   # має бути «імпортовано N заявок» і «слушаю … /api/admin»
```

### 4. Перший адміністратор

```bash
cd /home/deploy/leads-server
sudo -u deploy node --env-file=.env cli.mjs create-user --email ВАШ_EMAIL --name "Анна" --role admin
```

Команда покаже **тимчасовий пароль**. Відкрийте https://app.pika-leads.com, увійдіть з ним —
панель попросить задати власний пароль і підключити 2FA (Google Authenticator / 1Password / Authy).

Інших співробітників додавайте вже в самій панелі: **Команда → Добавить сотрудника**.

> Команди `cli.mjs` завжди запускайте через `sudo -u deploy` — інакше файли даних стануть
> власністю root і сервіс не зможе їх оновлювати.

### Консольні команди (якщо доступ втрачено)

```bash
cd /home/deploy/leads-server
sudo -u deploy node --env-file=.env cli.mjs list                                  # список співробітників
sudo -u deploy node --env-file=.env cli.mjs reset-password --email EMAIL          # новий тимчасовий пароль
sudo -u deploy node --env-file=.env cli.mjs reset-2fa --email EMAIL               # скинути 2FA (новий телефон)
```

### Резервна копія даних CRM

Усі дані — у папці `/home/deploy/leads-server` (`*.json`, `*.jsonl`, `secret.key`). Достатньо раз на день
копіювати їх в інше місце, наприклад:

```bash
crontab -u deploy -e
# додати рядок:
15 3 * * * tar czf /home/deploy/backup-crm-$(date +\%u).tgz -C /home/deploy/leads-server leads.json leads.jsonl users.json secret.key
```

(зберігає 7 щоденних копій по днях тижня)
