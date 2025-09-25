
interface OutputFormatter {
  check(output: string): boolean;
  format(output: string): string;
}

class TrimOutputFormatter implements OutputFormatter {
  check(output: string): boolean {
    return true;
  }

  format(output: string): string {
    output = output.trimStart();
    if (output.startsWith('/')) {
      output = output.substring(1);
    }
    return output.trimStart();
  }
}
class ResponseOutputFormatter {
  SEGMENTS = {
    Response: 'Response',
    PermissionsRequired: 'Permissions Required',
  };
  ALLOWED_SEGMENTS = [this.SEGMENTS.Response, this.SEGMENTS.PermissionsRequired];

  check(output: string): boolean {
    return true;
  }

  format(output: string): string {
    const lines = output.split('\n');
    const trimmedLines = [];
    let excluding = false;
    for (let line of lines) {
      if (line.startsWith('╭') && line.endsWith('╮')) {
        let ignoreSegment = true;
        for (const allowedSegment of this.ALLOWED_SEGMENTS) {
          if (line.includes(allowedSegment)) {
            ignoreSegment = false;
            break;
          }
        }
        if (ignoreSegment) {
          excluding = true;
        }
        continue;
      }
      if (line.startsWith('╰') && line.endsWith('╯')) {
        excluding = false;
        continue;
      }
      if (excluding) {
        continue;
      }
      if (line.includes('Type "/" for available commands') || line.includes('AI. Verify results.') || line.includes('│ > ')) {
        continue;
      }
      if (line.length <= 3) {
        continue;
      }
      if (line.startsWith('│') && line.endsWith('│')) {
        line = line.slice(1, -1);
      }
      trimmedLines.push(line);
    }
    return trimmedLines.join('\n');
  }
}

export function formatOutput(output: string): string {
  const formatters = [
    new TrimOutputFormatter(),
    new ResponseOutputFormatter(),
  ];
  let formatted = output;
  for (const formatter of formatters) {
    if (formatter.check(formatted)) {
      formatted = formatter.format(formatted);
    }
  }
  return formatted;
}