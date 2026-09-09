# Crown Design Invoices

A small desktop app (Electron) for writing, printing, and emailing job invoices. All the app logic lives in one file, `Invoice Maker.html`; `main.js` and `preload.js` give it the few things a web page cannot do on its own: write PDFs, write backups, and open Thunderbird with an attachment.

## Releases and updates

Every push to `main` runs the GitHub Action in `.github/workflows/release.yml`. It builds the Windows installer on a Windows runner, numbers it `1.0.<run number>`, and publishes it as a GitHub Release with the files the auto-updater reads. Nothing to do by hand.

The installed app checks GitHub for a newer release when it opens and every four hours after that, as long as **Check for updates automatically** is ticked in the admin panel. A new version downloads in the background and installs itself the next time he closes the app. The admin panel also shows the installed version, has a **Check for updates** button with live status, and a **Restart and update now** button once a download is ready. Invoices, settings, and backups live in `%APPDATA%\Crown Design Invoices`, which the installer never touches, so nothing is lost on an update or a reinstall.

To build locally instead: `npm install` then `npm run dist` (installer lands in `dist/`). If npm's script guard skipped the Electron download, run `node node_modules/electron/install.js` once. `npm start` runs the app on the Mac.

## Putting it on his computer the first time

1. Download `Crown Design Invoices Setup <version>.exe` from the latest GitHub Release and put it on a USB stick, or send him the link.
2. He double-clicks it. Windows SmartScreen will say "Windows protected your PC" because the installer is not code-signed: click **More info**, then **Run anyway**. It installs in a few seconds with no questions and puts **Crown Design Invoices** on the Desktop and in the Start menu.
3. First run: click **⚙ Admin** at the top and enter the passcode **1234**. Under **Company info & backup** fill in the company name, address, and phone number, and change the admin passcode to something of his own. Click Admin again to hide it. None of this is in the repo; it is stored only on his computer.

## How he uses it

- Click **+ New Invoice**. Type the customer name, phone, email, and the job address. Click **+ Add Area** for each room or trade, then type each line of work and its amount. Pressing Enter in an amount box starts the next line.
- The **Job tracking** card above the invoice is for him only and never prints: a Status (Ready to begin, Work started, Work completed, Partially paid, Fully paid), a Start date, a Completion date, and **Paid so far**. The balance due is worked out next to it.
- Totals, overhead, and profit are worked out for him. Everything saves by itself as he types.
- **Print** sends it straight to his real printer with no dialog, skipping virtual ones such as Microsoft Print to PDF even when Windows has one of those as default. The admin panel's **Printer** setting can pin a specific printer or switch to asking every time. **Save as PDF** writes `Invoice <number> - <customer>.pdf` into `Documents\Invoices`. **Email** saves that PDF and opens a new Thunderbird message addressed to the customer with the PDF attached and the invoice number and total already written. The app finds Thunderbird through the Windows registry or its usual folders; if it still cannot, the admin panel has a field for the full path to `thunderbird.exe`. Without Thunderbird the default mail program opens instead, without the attachment.
- **A−** and **A+** in the toolbar make the editing page smaller or larger for his eyes. The setting is remembered and never affects the printout.
- **Delete** asks him to type "delete" on a confirmation page before anything is removed.
- **Map of jobs** on the front page puts a dot on a map for every job address, coloured by status with a legend underneath. Click a dot for the customer, number, status, total, and an **Open invoice** button. The status tiles and the search box filter the map along with the list. Addresses are located through the free US Census geocoder the first time they are seen, one per second, and remembered in the invoice (an address with no city gets his own city and state from the admin panel added), so the map and new dots need an internet connection; the rest of the app does not.
- The front page lists every invoice, newest invoice date first, under month headings that stay on screen as he scrolls. The tiles at the top count jobs by status and add up **Outstanding payments** (final cost minus what was paid, skipping jobs marked Fully paid). Click a tile to filter, or type in the search box to find one by name, address, date, number, or status.

## Where the records live

Everything is in one readable file, `%APPDATA%\Crown Design Invoices\invoices.json`. The app rewrites it on every change (temp file then rename, so it is never half-written), keeps the previous copy as `invoices.json.bak`, and mirrors it to `%LOCALAPPDATA%\Crown Design Invoices Data\invoices.json`. On start it reads the first of those three that is intact. The installer never touches any of them, so updates and reinstalls keep every invoice.

- **Daily backup.** Once a day, the first time he opens or leaves an invoice, the app writes `invoices-auto-<date>.json` into `%APPDATA%\Crown Design Invoices\backups`. That folder is in the hidden AppData tree, so a stray click cannot delete a backup. The admin panel shows the date of the last one and has **Open daily backups folder**.
- **Manual backup.** Click **Save backup file** every so often and keep the file somewhere off the computer (OneDrive, a USB stick).
- **Restore.** **Restore from backup** in the admin panel reads either kind of file and merges it in.

## Development

`node test.mjs` checks the money math against the line items in `example_invoice.txt`. `Invoice Maker.html` also opens in a plain browser for quick layout work; there the PDF, email attachment, and daily backup features fall back to the print dialog and a plain mailto link.
