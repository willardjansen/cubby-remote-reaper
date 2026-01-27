// Web MIDI API Type Definitions

declare namespace WebMidi {
  interface MIDIOptions {
    sysex?: boolean;
    software?: boolean;
  }

  interface MIDIAccess {
    inputs: MIDIInputMap;
    outputs: MIDIOutputMap;
    onstatechange: ((event: MIDIConnectionEvent) => void) | null;
    sysexEnabled: boolean;
  }

  interface MIDIInputMap {
    size: number;
    forEach(callback: (input: MIDIInput, key: string) => void): void;
    get(key: string): MIDIInput | undefined;
    has(key: string): boolean;
    keys(): IterableIterator<string>;
    values(): IterableIterator<MIDIInput>;
    entries(): IterableIterator<[string, MIDIInput]>;
  }

  interface MIDIOutputMap {
    size: number;
    forEach(callback: (output: MIDIOutput, key: string) => void): void;
    get(key: string): MIDIOutput | undefined;
    has(key: string): boolean;
    keys(): IterableIterator<string>;
    values(): IterableIterator<MIDIOutput>;
    entries(): IterableIterator<[string, MIDIOutput]>;
  }

  interface MIDIPort {
    id: string;
    manufacturer: string;
    name: string;
    type: 'input' | 'output';
    version: string;
    state: 'connected' | 'disconnected';
    connection: 'open' | 'closed' | 'pending';
    onstatechange: ((event: MIDIConnectionEvent) => void) | null;
    open(): Promise<MIDIPort>;
    close(): Promise<MIDIPort>;
  }

  interface MIDIInput extends MIDIPort {
    type: 'input';
    onmidimessage: ((event: MIDIMessageEvent) => void) | null;
  }

  interface MIDIOutput extends MIDIPort {
    type: 'output';
    send(data: number[] | Uint8Array, timestamp?: number): void;
    clear(): void;
  }

  interface MIDIMessageEvent extends Event {
    data: Uint8Array;
  }

  interface MIDIConnectionEvent extends Event {
    port: MIDIPort;
  }
}

interface Navigator {
  requestMIDIAccess(options?: WebMidi.MIDIOptions): Promise<WebMidi.MIDIAccess>;
}
