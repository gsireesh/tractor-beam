import {Schema} from "@/lib/definitions.ts";

const COLORS = [
  'rgba(255, 182, 193, 0.3)', // pink
  'rgba(255, 218, 185, 0.3)', // peach
  'rgba(255, 255, 186, 0.3)', // yellow
  'rgba(186, 255, 201, 0.3)', // mint
  'rgba(186, 225, 255, 0.3)', // sky blue
  'rgba(216, 191, 255, 0.3)', // lavender
  'rgba(255, 200, 221, 0.3)', // rose
  'rgba(200, 255, 240, 0.3)', // aqua
  'rgba(255, 228, 196, 0.3)', // bisque
  'rgba(230, 230, 250, 0.3)', // periwinkle
]

export const placeholderSchemas: Schema[] = [
    {
        id: "0",
        name: "MatSci Schema",
        classes: [
            {
                id: "Material",
                name: "Material",
                color: 'rgba(255, 218, 185, 0.3)', // peach
                description:
                    "Materials that are used in the synthesis of the target. For example: Cr2O3, Strontium carbonate, BaTiO3, Li2CO3, Water, Ethanol",
                instances: [],
            },
            {
                id: "Nonrecipe Material",
                name: "Nonrecipe Material",
                color: 'rgba(255, 255, 186, 0.3)',
                description:
                    "Chemically specified\n" +
                    " materials that are not used in the synthesis of\n" +
                    " the synthesis target. For example: “BaTiO3\n" +
                    " powder (Ba/Ti=0.999)”, “Li2CO3 was used as\n" +
                    " the Li source”, “Si/Al ratio was 5”",
                instances: [],
            },
            {
                id: "Operation",
                name: "Operation",
                color: 'rgba(186, 225, 255, 0.3)',
                description:
                    "Discrete actions physically performed by the researcher or discrete process\n" +
                    "steps taken to synthesize the target.",
                instances: [],
            },
            {
                id: "Material Descriptor",
                name: "Material Descriptor",
                color: 'rgba(186, 255, 201, 0.3)',
                description:
                    "Describes a material’s structure, shape, form, type, role, etc.\n" +
                    "and must be directly or nearly adjacent to\n" +
                    "the material it describes. Does not include amounts, concentrations, " +
                    "or purities of materials. For example: CaCu3Ti4O12 compound,\n" +
                    "Copper ion, GaAs nanowires, Anatase TiO2\n" +
                    ", Deionized water ",
                instances: [],
            },
        ],
    },
    {
    "id": "1",
    "name": "STS Reading",
    "classes": [
        {
            "id": "d0f98a15-d86d-4143-b47a-823abfa4b661",
            "name": "Historical AI Projects",
            "description": "Examples of past AI projects.",
            "color": "rgba(142, 69, 177, 0.3)",
            "instances": [
                {
                    "id": "7b3b4b12-2ade-4311-93e5-123c08855c0e",
                    "instanceType": "text",
                    "text": "impacting",
                    "coords": [
                        {
                            "pageNumber": 1,
                            "left": 0.14759969839142092,
                            "top": 0.29783304361567636,
                            "width": 0.06447363368521,
                            "height": 0.01390644753476612
                        }
                    ],
                    "pdfUrl": "file:///Users/sireeshgururaja/Downloads/tobuild_truncated.pdf",
                    "positiveExample": false,
                    "notes": null
                },
                {
                    "id": "42a89696-060c-4ff7-8f0c-bc4de428e579",
                    "instanceType": "text",
                    "text": "software",
                    "coords": [
                        {
                            "pageNumber": 1,
                            "left": 0.3058808218484696,
                            "top": 0.4540336599241466,
                            "width": 0.05725048566311997,
                            "height": 0.01390644753476612
                        }
                    ],
                    "pdfUrl": "file:///Users/sireeshgururaja/Downloads/tobuild_truncated.pdf",
                    "positiveExample": true,
                    "notes": "I think this is really cool and interesting!"
                },
                {
                    "id": "f9de73df-ddba-43ec-9260-668607417508",
                    "instanceType": "text",
                    "text": "institution",
                    "coords": [
                        {
                            "pageNumber": 1,
                            "left": 0.3613593553028795,
                            "top": 0.3975606465840841,
                            "width": 0.06269020031971537,
                            "height": 0.013513513513513514
                        }
                    ],
                    "pdfUrl": "file:///Users/sireeshgururaja/Downloads/tobuild_truncated.pdf",
                    "positiveExample": false,
                    "notes": null
                }
            ]
        },
        {
            "id": "2dcb301f-c923-437f-b8ac-1043e896ae1f",
            "name": "Methods/Approaches",
            "description": "Methods and approaches used in the study of AI.\n\nThis category might include, but is not limited to methods like string matching, NN",
            "color": "rgba(28, 111, 177, 0.3)",
            "instances": [
                {
                    "id": "f5e4fbe8-66f6-4ea6-9678-e120507cbc0b",
                    "instanceType": "text",
                    "text": "categorization",
                    "positiveExample": true,
                    "coords": [
                        {
                            "pageNumber": 1,
                            "left": 0.5720693262926285,
                            "top": 0.4647596697118938,
                            "width": 0.09022390024410079,
                            "height": 0.012599328966449582
                        }
                    ],
                    "pdfUrl": "file:///Users/sireeshgururaja/Downloads/suchman-2023-the-uncontroversial-thingness-of-ai.pdf"
                },
                {
                    "id": "32dbccc0-8b28-4107-a763-e5f71511d572",
                    "instanceType": "text",
                    "text": "infrastructure",
                    "coords": [
                        {
                            "pageNumber": 1,
                            "left": 0.22121674353335083,
                            "top": 0.3689096850861557,
                            "width": 0.09426643948595063,
                            "height": 0.013666072489601902
                        }
                    ],
                    "pdfUrl": "file:///Users/sireeshgururaja/Downloads/tobuild_truncated.pdf",
                    "positiveExample": false,
                    "notes": null
                },
                {
                    "id": "60b1c356-a661-4b8d-8146-3ba09d4998c3",
                    "instanceType": "text",
                    "text": "to tackle these big challenges, we must understand\nthe factors — norms, incentives, technology and\nculture — that led to our current crossroads.\nWe presen",
                    "coords": [
                        {
                            "pageNumber": 1,
                            "left": 0.5142988445378152,
                            "top": 0.6126104797979798,
                            "width": 0.36693289620535713,
                            "height": 0.015151515151515152
                        },
                        {
                            "pageNumber": 1,
                            "left": 0,
                            "top": 0.5199049316696376,
                            "width": 0,
                            "height": 0.008318478906714201
                        },
                        {
                            "pageNumber": 1,
                            "left": 0.5142988445378152,
                            "top": 0.6298973187759952,
                            "width": 0.3669499245010504,
                            "height": 0.012965129233511586
                        },
                        {
                            "pageNumber": 1,
                            "left": 0.5142988445378152,
                            "top": 0.6287089646464646,
                            "width": 0.3669499245010504,
                            "height": 0.015151515151515152
                        },
                        {
                            "pageNumber": 1,
                            "left": 0,
                            "top": 0.5270350564468211,
                            "width": 0,
                            "height": 0.008318478906714201
                        },
                        {
                            "pageNumber": 1,
                            "left": 0.5142988445378152,
                            "top": 0.6458983214497921,
                            "width": 0.323939321822479,
                            "height": 0.012965129233511586
                        },
                        {
                            "pageNumber": 1,
                            "left": 0.5142988445378152,
                            "top": 0.6447099673202614,
                            "width": 0.323939321822479,
                            "height": 0.015151515151515152
                        },
                        {
                            "pageNumber": 1,
                            "left": 0,
                            "top": 0.5341651812240048,
                            "width": 0,
                            "height": 0.008318478906714201
                        },
                        {
                            "pageNumber": 1,
                            "left": 0.5325958508403361,
                            "top": 0.6629112819370172,
                            "width": 0.08136530002626051,
                            "height": 0.015151515151515152
                        }
                    ],
                    "pdfUrl": "file:///Users/sireeshgururaja/Downloads/tobuild_truncated.pdf",
                    "positiveExample": true,
                    "notes": "this is what I'm thinking about"
                }
            ]
        }
    ]
}
];