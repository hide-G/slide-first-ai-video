import { describe, it, expect } from "vitest";
import { parseSpeechMarks, getWordMarks } from "./speech-marks-parser.js";

describe("parseSpeechMarks", () => {
  it("parses valid JSONL speech marks", () => {
    const content = [
      '{"time":0,"type":"word","start":0,"end":5,"value":"Hello"}',
      '{"time":500,"type":"word","start":6,"end":11,"value":"world"}',
    ].join("\n");

    const result = parseSpeechMarks(content);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      time: 0,
      type: "word",
      start: 0,
      end: 5,
      value: "Hello",
    });
    expect(result[1]).toEqual({
      time: 500,
      type: "word",
      start: 6,
      end: 11,
      value: "world",
    });
  });

  it("handles mixed mark types (word, sentence, viseme)", () => {
    const content = [
      '{"time":0,"type":"sentence","start":0,"end":12,"value":"Hello world."}',
      '{"time":0,"type":"word","start":0,"end":5,"value":"Hello"}',
      '{"time":500,"type":"word","start":6,"end":11,"value":"world"}',
    ].join("\n");

    const result = parseSpeechMarks(content);
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe("sentence");
    expect(result[1].type).toBe("word");
    expect(result[2].type).toBe("word");
  });

  it("skips empty lines", () => {
    const content = [
      '{"time":0,"type":"word","start":0,"end":5,"value":"Hello"}',
      "",
      '{"time":500,"type":"word","start":6,"end":11,"value":"world"}',
      "",
    ].join("\n");

    const result = parseSpeechMarks(content);
    expect(result).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(parseSpeechMarks("")).toEqual([]);
    expect(parseSpeechMarks("  \n  \n")).toEqual([]);
  });

  it("handles single mark", () => {
    const content = '{"time":100,"type":"word","start":0,"end":3,"value":"Hi"}';
    const result = parseSpeechMarks(content);
    expect(result).toHaveLength(1);
    expect(result[0].time).toBe(100);
  });
});

describe("getWordMarks", () => {
  it("filters to only word-type marks", () => {
    const content = [
      '{"time":0,"type":"sentence","start":0,"end":12,"value":"Hello world."}',
      '{"time":0,"type":"word","start":0,"end":5,"value":"Hello"}',
      '{"time":500,"type":"word","start":6,"end":11,"value":"world"}',
    ].join("\n");

    const marks = parseSpeechMarks(content);
    const wordMarks = getWordMarks(marks);

    expect(wordMarks).toHaveLength(2);
    expect(wordMarks[0].value).toBe("Hello");
    expect(wordMarks[1].value).toBe("world");
  });

  it("returns empty array when no word marks exist", () => {
    const content =
      '{"time":0,"type":"sentence","start":0,"end":12,"value":"Hello world."}';
    const marks = parseSpeechMarks(content);
    const wordMarks = getWordMarks(marks);
    expect(wordMarks).toEqual([]);
  });
});
