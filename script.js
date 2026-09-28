// -------------------------
// 1. RISK SCORE DISPLAY
// -------------------------

function showRisk(score) {
    document.getElementById("risk").textContent =
        "Risk Score: " + score;
}


// -------------------------
// 2. REFRESH BUTTON
// -------------------------

const refreshButton =
    document.getElementById("refreshButton");


// -------------------------
// 3. CREATE CYTOSCAPE GRAPH
// -------------------------

const cy = cytoscape({

    container: document.getElementById("cy"),

    // Start empty because data comes from devices.json
    elements: [],


    // -------------------------
    // 4. GRAPH STYLE
    // -------------------------

    style: [

        // Default node style
        {
            selector: "node",

            style: {
                "label": "data(label)",
                "color": "white",
                "background-color": "gray"
            }
        },


        // Low risk
        {
            selector: "node[riskScore < 0.30]",

            style: {
                "background-color": "green",
                "width": 30,
                "height": 30
            }
        },


        // Medium risk
        {
            selector:
                "node[riskScore >= 0.30][riskScore < 0.70]",

            style: {
                "background-color": "orange",
                "width": 45,
                "height": 45
            }
        },


        // High risk
        {
            selector: "node[riskScore >= 0.70]",

            style: {
                "background-color": "red",
                "width": 60,
                "height": 60
            }
        },


        // Edge style
        {
            selector: "edge",

            style: {
                "width": 3,
                "line-color": "gray"
            }
        },


        // Selected node
        {
            selector: "node:selected",

            style: {
                "border-width": 4,
                "border-color": "white"
            }
        }
    ]
});


// -------------------------
// 5. GRAPH STATE
// -------------------------

let graphNodes = [];

let currentNodeIndex = 0;


// -------------------------
// 6. DISPLAY A NODE
// -------------------------

function showNode(node) {

    cy.$("node").unselect();

    node.select();

    const name = node.data("label");
    const ip = node.data("ip");
    const riskScore = node.data("riskScore");

    document.getElementById("deviceInfo").textContent =
        "Device: " + name + " | IP: " + ip;

    showRisk(riskScore);
}


// -------------------------
// 7. UPDATE NODE RISK
// -------------------------

function updateNodeRisk(nodeId, newRisk) {

    const node = cy.getElementById(nodeId);

    node.data("riskScore", newRisk);


    // Only refresh the displayed score
    // if this is the node the user selected
    if (node.selected()) {
        showRisk(newRisk);
    }
}


// -------------------------
// 8. LOAD EVENTS
// -------------------------

async function loadEvents() {

    try {

        const response =
            await fetch("./events.json");


        // HTTP validation
        if (!response.ok) {
            throw new Error(
                "HTTP error: " + response.status
            );
        }


        // Parse JSON
        const data =
            await response.json();


        // Check overall event structure
        if (!Array.isArray(data.events)) {
            throw new Error(
                "Invalid events data format"
            );
        }


        // Validate every event
        const invalidEvent =
            data.events.find(function (event) {

                return (
                    typeof event.nodeId !== "string" ||
                    typeof event.riskScore !== "number" ||
                    event.riskScore < 0 ||
                    event.riskScore > 1
                );

            });


        if (invalidEvent) {
            throw new Error(
                "Invalid event data"
            );
        }


        // Check that every event references
        // a node that already exists
        const unknownEvent =
            data.events.find(function (event) {

                const node =
                    cy.getElementById(event.nodeId);

                return node.length === 0;

            });


        if (unknownEvent) {
            throw new Error(
                "Event references unknown node"
            );
        }


        console.log(
            "Events data:",
            data
        );


        // Apply events only after
        // the whole batch has been validated
        data.events.forEach(function (event) {

            updateNodeRisk(
                event.nodeId,
                event.riskScore
            );

        });

    }

    catch (error) {

        console.error(
            "Failed to load events:",
            error
        );


        document.getElementById(
            "statusMessage"
        ).textContent =
            "Failed to load event updates.";
    }
}


// -------------------------
// 9. LOAD DEVICES FROM JSON
// -------------------------

async function loadDevices() {

    // Loading state
    document.getElementById(
        "statusMessage"
    ).textContent =
        "Loading network data...";


    document.getElementById(
        "controls"
    ).style.display = "none";


    refreshButton.disabled = true;


    try {

        console.log(
            "loadDevices started"
        );


        // Fetch initial network data
        const response =
            await fetch("./devices.json");


        console.log(
            "HTTP status:",
            response.status
        );


        // HTTP validation
        if (!response.ok) {
            throw new Error(
                "HTTP error: " + response.status
            );
        }


        // Parse JSON
        const data =
            await response.json();


        // -------------------------
        // DATA VALIDATION
        // -------------------------

        // Check overall structure
        if (
            !Array.isArray(data.nodes) ||
            !Array.isArray(data.edges)
        ) {

            throw new Error(
                "Invalid network data format"
            );
        }


        // Validate every node
        const invalidNode =
            data.nodes.find(function (node) {

                return (
                    typeof node.id !== "string" ||
                    typeof node.label !== "string" ||
                    typeof node.ip !== "string" ||
                    typeof node.riskScore !== "number" ||
                    node.riskScore < 0 ||
                    node.riskScore > 1
                );

            });


        if (invalidNode) {
            throw new Error(
                "Invalid node data"
            );
        }


        // Validate every edge
        const invalidEdge =
            data.edges.find(function (edge) {

                return (
                    typeof edge.id !== "string" ||
                    typeof edge.source !== "string" ||
                    typeof edge.target !== "string"
                );

            });


        if (invalidEdge) {
            throw new Error(
                "Invalid edge data"
            );
        }


        // Collect all node IDs
        const nodeIds =
            data.nodes.map(function (node) {

                return node.id;

            });


        // Check edge references
        const brokenEdge =
            data.edges.find(function (edge) {

                return (
                    !nodeIds.includes(edge.source) ||
                    !nodeIds.includes(edge.target)
                );

            });


        if (brokenEdge) {
            throw new Error(
                "Edge references unknown node"
            );
        }


        // -------------------------
        // EMPTY STATE
        // -------------------------

        if (data.nodes.length === 0) {

            document.getElementById(
                "statusMessage"
            ).textContent =
                "No network data available.";


            document.getElementById(
                "deviceInfo"
            ).textContent = "";


            document.getElementById(
                "controls"
            ).style.display = "none";


            return;
        }


        console.log(
            "Data:",
            data
        );


        // -------------------------
        // CONVERT DATA FOR CYTOSCAPE
        // -------------------------

        const nodeElements =
            data.nodes.map(function (node) {

                return {
                    data: node
                };

            });


        const edgeElements =
            data.edges.map(function (edge) {

                return {
                    data: edge
                };

            });


        console.log(
            "Cytoscape nodes:",
            nodeElements
        );


        // -------------------------
        // ADD DATA TO GRAPH
        // -------------------------

        cy.add(nodeElements);

        cy.add(edgeElements);


        cy.layout({
            name: "grid"
        }).run();


        // Cytoscape now contains the nodes
        graphNodes =
            cy.nodes().toArray();


        currentNodeIndex = 0;


        // Initially display first node
        showNode(
            graphNodes[currentNodeIndex]
        );


        // -------------------------
        // SUCCESS STATE
        // -------------------------

        document.getElementById(
            "statusMessage"
        ).textContent = "";


        document.getElementById(
            "controls"
        ).style.display = "flex";


        refreshButton.disabled = false;


        // -------------------------
        // MOCK EVENT REQUEST
        // -------------------------

        // Pretend new backend event data
        // is requested 3 seconds later
        setTimeout(function () {

            loadEvents();

        }, 3000);

    }

    catch (error) {

        console.error(
            "Fetch failed:",
            error
        );


        // Error state
        document.getElementById(
            "statusMessage"
        ).textContent =
            "Failed to load network data.";


        document.getElementById(
            "deviceInfo"
        ).textContent = "";


        document.getElementById(
            "controls"
        ).style.display = "none";


        refreshButton.disabled = true;
    }
}


// -------------------------
// 10. CLICK A GRAPH NODE
// -------------------------

cy.on(
    "tap",
    "node",
    function (event) {

        const node =
            event.target;


        currentNodeIndex =
            graphNodes.findIndex(
                function (graphNode) {

                    return (
                        graphNode.id() ===
                        node.id()
                    );

                }
            );


        showNode(node);
    }
);


// -------------------------
// 11. REFRESH → NEXT NODE
// -------------------------

refreshButton.addEventListener(
    "click",
    function () {

        if (graphNodes.length === 0) {
            return;
        }


        currentNodeIndex =
            (currentNodeIndex + 1) %
            graphNodes.length;


        showNode(
            graphNodes[currentNodeIndex]
        );
    }
);


// -------------------------
// 12. START APPLICATION
// -------------------------

loadDevices();