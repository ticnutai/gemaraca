import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  TableRow,
  TableCell,
  Table,
  WidthType,
  ShadingType,
} from 'docx';

interface PsakData {
  title: string;
  court: string;
  year: number;
  case_number?: string | null;
  full_text?: string | null;
  summary?: string | null;
}

export async function generateDocx(data: PsakData): Promise<Blob> {
  const textContent = data.full_text || data.summary || '';
  const paragraphs = textContent.split('\n').filter(Boolean);

  const metaCells = [
    `בית דין: ${data.court}`,
    `שנה: ${data.year}`,
    ...(data.case_number ? [`תיק: ${data.case_number}`] : []),
  ];

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'David',
            size: 24,
            rightToLeft: true,
          },
          paragraph: {
            alignment: AlignmentType.RIGHT,
            bidirectional: true,
            spacing: { after: 120, line: 360 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, right: 1440, left: 1440 },
          },
        },
        children: [
          // Title
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.RIGHT,
            bidirectional: true,
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 6, color: '2b6cb0' },
            },
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: data.title,
                bold: true,
                size: 36,
                color: '1a365d',
                font: 'David',
                rightToLeft: true,
              }),
            ],
          }),

          // Metadata table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: metaCells.map(
                  (cell) =>
                    new TableCell({
                      width: { size: Math.floor(100 / metaCells.length), type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.SOLID, color: 'f0f4f8', fill: 'f0f4f8' },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.RIGHT,
                          bidirectional: true,
                          children: [
                            new TextRun({
                              text: cell,
                              size: 22,
                              color: '4a5568',
                              font: 'David',
                              rightToLeft: true,
                            }),
                          ],
                        }),
                      ],
                    })
                ),
              }),
            ],
          }),

          // Spacer
          new Paragraph({ spacing: { before: 240 }, children: [] }),

          // Content paragraphs
          ...paragraphs.map(
            (text) =>
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                bidirectional: true,
                spacing: { after: 120, line: 360 },
                children: [
                  new TextRun({
                    text,
                    size: 24,
                    font: 'David',
                    rightToLeft: true,
                  }),
                ],
              })
          ),
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
}
