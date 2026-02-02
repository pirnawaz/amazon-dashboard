# Docker Desktop on Windows 11 – Step-by-Step Guide

Beginner-friendly guide to reinstall Docker Desktop, enable WSL2, verify everything works, and run your project with `docker compose up -d`.

---

## Part 1: Enable WSL2 (do this first)

WSL2 is required for Docker Desktop on Windows 11.

### 1.1 Open PowerShell as Administrator

- Press **Win**, type **PowerShell**
- Right-click **Windows PowerShell** → **Run as administrator**

### 1.2 Install WSL (Windows Subsystem for Linux)

Run this command. It installs WSL and the default Ubuntu distro. You may be asked to restart.

```powershell
wsl --install
```

If you already had WSL but want to ensure WSL2 is the default:

```powershell
wsl --set-default-version 2
```

### 1.3 Restart if prompted

After `wsl --install`, if Windows asks to restart, do it. Then open PowerShell again (normal or Admin) and continue.

### 1.4 (Optional) Confirm WSL is working

```powershell
wsl --list --verbose
```

You should see a distro (e.g. `Ubuntu`) with **VERSION 2**.

---

## Part 2: Install Docker Desktop

### 2.1 Download Docker Desktop

1. Go to: **https://www.docker.com/products/docker-desktop/**
2. Click **Download for Windows**.
3. Run the installer (`Docker Desktop Installer.exe`).

### 2.2 Run the installer

- If asked, choose **Use WSL 2 instead of Hyper-V** (recommended on Windows 11).
- Leave **Add shortcut to desktop** checked if you want.
- Click **OK** and wait for installation to finish.
- When it asks to **restart**, click **Close and restart**.

### 2.3 First launch

- After restart, start **Docker Desktop** from the Start menu.
- Accept the Docker Subscription Service Agreement if shown.
- Wait until the whale icon in the system tray stops animating and Docker says it’s running.

---

## Part 3: Docker Desktop settings (use WSL2 backend)

1. Click the **gear icon** (Settings) in Docker Desktop.
2. Go to **General**.
3. Ensure these are checked:
   - **Use the WSL 2 based engine**
   - **Start Docker Desktop when you sign in** (optional)
4. Click **Apply & restart** if you changed anything.

---

## Part 4: Verify Docker and Docker Compose in PowerShell

Open **PowerShell** (no need for Admin this time). Use your project folder or any folder.

### 4.1 Check Docker

```powershell
docker --version
```

Example output: `Docker version 24.x.x, build ...`

### 4.2 Check Docker Compose (plugin)

```powershell
docker compose version
```

Example output: `Docker Compose version v2.x.x` (or similar).

### 4.3 Quick functional test

```powershell
docker run --rm hello-world
```

You should see a short message ending with “Hello from Docker!”. That confirms the Docker daemon and CLI work.

---

## Part 5: Run `docker compose up -d` from your project folder

### 5.1 Open PowerShell in your project folder

Either:

- In File Explorer: go to your project folder → **Shift + Right‑click** → **Open PowerShell window here**, or  
- In PowerShell:

```powershell
cd "d:\Cursor\Amazon\amazon-dashboard"
```

(Use the folder that actually contains your `docker-compose.yml` or `compose.yaml`.)

### 5.2 Run Compose in detached mode

```powershell
docker compose up -d
```

- **`up`** – builds (if needed) and starts all services defined in `docker-compose.yml`.
- **`-d`** – runs in the background (detached).

### 5.3 Useful follow-up commands

- See running containers:

  ```powershell
  docker compose ps
  ```

- View logs:

  ```powershell
  docker compose logs -f
  ```
  (Ctrl+C to stop following.)

- Stop and remove containers (keep images):

  ```powershell
  docker compose down
  ```

---

## Important note about this repo

Your **amazon-dashboard** README mentions Docker Compose (db, backend, frontend, caddy), but there is **no `docker-compose.yml`** in the repo yet. So:

- **If you add a `docker-compose.yml`** (e.g. in `d:\Cursor\Amazon\amazon-dashboard\`), then run:

  ```powershell
  cd "d:\Cursor\Amazon\amazon-dashboard"
  docker compose up -d
  ```

- **If the file is in a different folder**, `cd` to that folder first, then run `docker compose up -d`.

Until a `docker-compose.yml` exists in the folder you’re in, `docker compose up -d` will fail with an error like “no configuration file provided”.

---

## Troubleshooting

| Problem | What to try |
|--------|-------------|
| `docker` not recognized | Restart PowerShell after installing Docker Desktop; ensure Docker Desktop is running (whale icon in tray). |
| “Docker daemon not running” | Start Docker Desktop from the Start menu and wait until it’s ready. |
| WSL2 not found / version 1 | In PowerShell (Admin): `wsl --set-default-version 2` and restart. |
| “no configuration file provided” | Run `docker compose up -d` from the folder that contains `docker-compose.yml` or `compose.yaml`. |

---

## Summary checklist

- [ ] WSL2 installed (`wsl --install`) and optionally set as default (`wsl --set-default-version 2`)
- [ ] Restarted if installer asked
- [ ] Docker Desktop installed and opened at least once
- [ ] Settings → General → **Use the WSL 2 based engine** enabled
- [ ] `docker --version` and `docker compose version` work in PowerShell
- [ ] `docker run --rm hello-world` succeeds
- [ ] `docker compose up -d` run from the folder that contains your `docker-compose.yml`
