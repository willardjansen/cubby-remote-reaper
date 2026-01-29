# Cubby Remote for Reaper

Articulation switcher and template builder for Reaper with Reaticulate, designed for iPad/tablet use.

## Features

- **iPad Optimized** - Touch-friendly interface designed for tablets
- **Reaticulate Integration** - Works with Reaticulate articulation maps
- **Template Builder** - Generate Reaticulate .reabank files
- **Auto Port Detection** - Automatically finds available ports (avoids macOS AirPlay conflicts)
- **MIDI Bridge** - WebSocket-based MIDI bridge for iPad connectivity
- **System Tray App** - Runs in menu bar/system tray, always accessible

## Quick Start

### Download

Download the latest release:
- macOS Intel: `Cubby Remote Reaper-x.x.x.dmg`
- macOS Apple Silicon: `Cubby Remote Reaper-x.x.x-arm64.dmg`
- Windows: `Cubby Remote Reaper Setup x.x.x.exe`

### Setup

1. **Install the app** - Run the installer
2. **Launch** - The app runs in the system tray/menu bar
3. **Access on iPad** - Open `http://YOUR_COMPUTER_IP:7100` in Safari

### MIDI Setup

**macOS:**
1. Open **Audio MIDI Setup** (Applications → Utilities)
2. Go to **Window → Show MIDI Studio**
3. Double-click **IAC Driver**
4. Check **"Device is online"**
5. Add a bus for articulation switching

**Windows:**
1. Install [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html)
2. Create a virtual MIDI port

### Reaper/Reaticulate Setup

1. Install [Reaticulate](https://reaticulate.com/)
2. Configure Reaticulate to receive MIDI from the virtual port
3. Assign articulation maps to your tracks

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Windows/Mac Host                          │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │  Next.js    │◀──▶│ MIDI Bridge  │◀──▶│    Reaper     │  │
│  │  Web App    │    │  Server      │    │ + Reaticulate │  │
│  │  :7100      │    │  :7101       │    │               │  │
│  └─────────────┘    └──────────────┘    └───────────────┘  │
│         ▲                  ▲                   ▲            │
└─────────│──────────────────│───────────────────│────────────┘
          │ HTTP             │ WebSocket         │ MIDI
          │                  │                   │
     ┌────┴──────────────────┴────┐         loopMIDI (Win)
     │         iPad               │         IAC Driver (Mac)
     │   Safari/Chrome Browser    │
     └────────────────────────────┘
```

## Troubleshooting

### Tablet shows ERR_SSL_PROTOCOL_ERROR

If you see SSL errors when connecting from a tablet:

1. Make sure you're using `http://` (not `https://`) in the URL
2. Try using an **incognito/private browsing** window
3. Clear the browser cache if you previously tried with HTTPS

The app uses HTTP by default, which works fine for local networks.

### iPad shows "MIDI Bridge not running"

Make sure the app is running (check system tray/menu bar icon).

### Ports are busy

The app automatically finds available ports starting from 7100. If you see port conflicts:
- Check for other Cubby apps running
- Quit any apps using ports 7100-7110

### Open Reabank/Templates Folder

Right-click the tray icon to access:
- **Open Reabank Folder** - Where Reaper stores .reabank files
- **Open Templates Folder** - Your saved templates

## Development

```bash
# Install dependencies
npm install

# Run in development
npm run electron:dev

# Build for distribution
npm run electron:build
```

## License

MIT License

## Author

**Willard Jansen** - [Cubby](https://cubby.audio)
