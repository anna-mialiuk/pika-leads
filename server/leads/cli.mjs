/**
 * Керування користувачами адмінки з консолі сервера.
 * Запускати від користувача deploy, у папці приймача:
 *
 *   cd /home/deploy/leads-server
 *   sudo -u deploy node --env-file=.env cli.mjs create-user --email you@mail.com --name "Анна" --role admin
 *   sudo -u deploy node --env-file=.env cli.mjs reset-password --email you@mail.com
 *   sudo -u deploy node --env-file=.env cli.mjs reset-2fa --email you@mail.com
 *   sudo -u deploy node --env-file=.env cli.mjs list
 *
 * Перезапуск сервісу не потрібен — він сам перечитає users.json.
 */
import {
  createUser,
  findUserByEmail,
  generatePassword,
  hashPassword,
  publicUser,
  users,
} from "./auth.mjs";

const [command, ...rest] = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i += 2) args[rest[i].replace(/^--/, "")] = rest[i + 1];

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

const target = () => findUserByEmail(args.email) || fail(`Пользователь ${args.email} не найден`);

switch (command) {
  case "create-user": {
    if (!args.email) fail("Укажите --email");
    const { user, tempPassword } = await createUser({
      email: args.email,
      name: args.name,
      role: args.role || "manager",
    }).catch((error) => fail(error.message));
    console.log(`✓ Создан: ${user.email} (${user.role})`);
    console.log(`  Временный пароль: ${tempPassword}`);
    console.log("  При первом входе нужно будет сменить пароль и подключить 2FA.");
    break;
  }
  case "reset-password": {
    const user = target();
    const tempPassword = generatePassword();
    const passwordHash = await hashPassword(tempPassword);
    users.update(user.id, (u) => {
      u.passwordHash = passwordHash;
      u.mustChangePassword = true;
      u.tokenVersion = (u.tokenVersion || 0) + 1;
    });
    console.log(`✓ Новый временный пароль для ${user.email}: ${tempPassword}`);
    break;
  }
  case "reset-2fa": {
    const user = target();
    users.update(user.id, (u) => {
      u.totpEnabled = false;
      u.totpSecret = null;
      u.totpPending = null;
      u.tokenVersion = (u.tokenVersion || 0) + 1;
    });
    console.log(`✓ 2FA сброшена для ${user.email} — при входе её нужно будет подключить заново`);
    break;
  }
  case "list": {
    for (const user of users.all().map(publicUser)) {
      console.log(
        `${String(user.id).padStart(3)}  ${user.email.padEnd(32)} ${user.role.padEnd(8)} ${user.totpEnabled ? "2FA" : "   "} ${user.disabled ? "заблокирован" : ""}`,
      );
    }
    break;
  }
  default:
    console.log("Команды: create-user, reset-password, reset-2fa, list (см. комментарий в cli.mjs)");
}
