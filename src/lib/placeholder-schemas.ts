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
                instances: [{id: 0, description: "Test Entity", content: "content"}],
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
];