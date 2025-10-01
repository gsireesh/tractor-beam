import {Schema} from "@/lib/definitions.ts";

export const placeholderSchemas: Schema[] = [
    {
        id: "0",
        name: "MatSci Schema",
        classes: [
            {
                id: "Material",
                name: "Material",
                description:
                    "Materials that are used in the synthesis of the target. For example: Cr2O3, Strontium carbonate, BaTiO3, Li2CO3, Water, Ethanol",
                instances: [{id: 0, description: "Test Entity", content: "content"}],
            },
            {
                id: "Nonrecipe Material",
                name: "Nonrecipe Material",
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
                description:
                    "Discrete actions physically performed by the researcher or discrete process\n" +
                    "steps taken to synthesize the target.",
                instances: [],
            },
            {
                id: "Material Descriptor",
                name: "Material Descriptor",
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