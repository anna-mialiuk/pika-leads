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
