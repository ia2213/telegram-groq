import sys
import asyncio
import edge_tts

async def main():
    if len(sys.argv) < 4:
        sys.exit(1)
    text = sys.argv[1]
    voice = sys.argv[2]
    output_path = sys.argv[3]
    rate = sys.argv[4] if len(sys.argv) > 4 else "+0%"
    
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    await communicate.save(output_path)

if __name__ == "__main__":
    asyncio.run(main())
