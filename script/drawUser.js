// Misc
let MAX_PATH_LEN = 100;

// Environments
const canvas_phys = document.getElementById('physCanvas');
const canvas_virt = document.getElementById('virtCanvas');
let border_phys = [{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
let border_virt = [{ x: 0, y: 0 }, { x: 0, y: 200 }, { x: 200, y: 0 }, { x: 200, y: 200 }];
let obstacles_phys = [
    [{ x: 20, y: 20 }, { x: 20, y: 40 }, { x: 40, y: 40 }, { x: 40, y: 20 }],
    [{ x: 60, y: 60 }, { x: 60, y: 80 }, { x: 80, y: 80 }, { x: 80, y: 60 }]
];
let obstacles_virt = []

// User position and path in both environemnts
let user_phys = { x: 50, y: 50, angle: 0, velocity: 0 };  // Initial user state
let user_virt = { x: 50, y: 50, angle: 0, velocity: 0 };

// User config
let poi = [{ x: 50, y: 150 }, { x: 150, y: 150 }, { x: 150, y: 50 }, { x: 50, y: 50 }]
let poi_index = 0;
let is_rotating = false;
let walk_speed = 1;    // pixel/frame
let turn_speed = 0.1;   // radius/frame

// User log info
let log_phys = [{ x: user_phys.x, y: user_phys.y }];   // TODO: Log more user info
let log_virt = [{ x: user_virt.x, y: user_virt.y }];

function drawPolygon(ctx, points) {
    // Find min max to get center
    // Sort from top to bottom
    points.sort((a, b) => a.y - b.y);

    // Get center y
    const cy = (points[0].y + points[points.length - 1].y) / 2;

    // Sort from right to left
    points.sort((a, b) => b.x - a.x);

    // Get center x
    const cx = (points[0].x + points[points.length - 1].x) / 2;

    // Center point
    const center = { x: cx, y: cy };

    // Starting angle used to reference other angles
    var startAng;
    points.forEach(point => {
        var ang = Math.atan2(point.y - center.y, point.x - center.x);
        if (!startAng) { startAng = ang }
        else {
            if (ang < startAng) {  // ensure that all points are clockwise of the start point
                ang += Math.PI * 2;
            }
        }
        point.angle = ang; // add the angle to the point
    });

    // Sort clockwise;
    points.sort((a, b) => a.angle - b.angle);

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
}

// Draw environment
function drawEnvironment(ctx, border, obstacles) {
    // Draw border
    drawPolygon(ctx, border);
    ctx.stroke();

    // Draw obstacles
    ctx.fillStyle = "red"
    for (let i = 0; i < obstacles.length; i++) {
        drawPolygon(ctx, obstacles[i]);
        ctx.fill();
    }
}

// Draw the user on the canvas
function drawUser(ctx, user, path) {
    // Draw path
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
        ctx.stroke();
    }

    // Draw the user
    ctx.beginPath();
    ctx.arc(user.x, user.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'blue';
    ctx.fill();
    ctx.closePath();
}

function drawPhys() {
    ctx = canvas_phys.getContext('2d');
    ctx.clearRect(0, 0, canvas_phys.width, canvas_phys.height);

    drawEnvironment(
        ctx,
        border_phys.map(element => ({ x: element.x * 5, y: element.y * 5 })),
        obstacles_phys.map(a => (
            a.map(element => (
                { x: element.x * 5, y: element.y * 5 })
            )
        ))
    );
    drawUser(
        ctx,
        { x: user_phys.x * 5, y: user_phys.y * 5 },
        log_phys.map(element => ({ x: element.x * 5, y: element.y * 5 }))
    );
}

function drawVirt() {
    ctx = canvas_virt.getContext('2d');
    ctx.clearRect(0, 0, canvas_virt.width, canvas_virt.height);

    drawEnvironment(ctx, border_virt, obstacles_virt);
    drawUser(ctx, user_phys, log_phys);
}

// Test when no socket
drawPhys();
drawVirt();

// -------------------------- WebSocket -----------------------------

// Set up WebSocket connection to local Python server
const ws = new WebSocket('ws://localhost:8765');  // Connect to the local Python program

// WS Protocol
function sendStartMsg() {
    // TODO: Get configuration from user input fields

    // Compose start message
    const start_msg =
    {
        type: "start",
        physical: {
            height: 100,
            width: 100,
            border: border_phys,
            obstacle_list: obstacles_phys,
        },
        virtual: {
            height: 200,
            width: 200,
            border: border_virt,
            obstacle_list: obstacles_virt,
        }
    };

    // Send start message
    ws.send(JSON.stringify(start_msg));
}

function sendRunMsg() {
    // TODO: need_reset detection
    let need_reset = false;

    const run_msg = {
        type: "running",
        physical: {
            user_x: user_phys.x,
            user_y: user_phys.y,
            user_direction: user_phys.angle
        },
        virtual: {
            user_x: user_virt.x,
            user_y: user_virt.y,
            user_direction: user_virt.angle
        },
        user_v: user_virt.velocity,
        delta_t: 0.02,
        need_reset: need_reset
    };
}

function sendEndMsg() {
    const end_msg = {
        type: "end",
    };
}

function walk() {
    if (poi_index >= poi.length) {
        return false;
    }

    // Rotate/walk towards next poi with configured speed
    const target_poi = poi[poi_index];
    const target_direction = {
        x: target_poi.x - user_virt.x,
        y: target_poi.y - user_virt.y
    };

    const distance = Math.sqrt(target_direction.x ** 2 + target_direction.y ** 2);
    const target_angle = Math.atan2(target_direction.y, target_direction.x); // Angle to the target

    // Check if the walker is rotating or moving
    if (is_rotating) {
        // Rotate towards the target angle
        user_direction += turn_speed;
        if (Math.abs(user_direction - target_angle) < 0.01) {
            user_direction = target_angle; // Snap to the target angle
            is_rotating = false; // Stop rotating
            // console.log(`Finished rotating towards POI: ${JSON.stringify(targetPOI)}`);
        }
    } else {
        // Move towards the target POI if not rotating
        if (distance > walk_speed) {
            const normalizedDirection = {
                x: target_direction.x / distance,
                y: target_direction.y / distance
            };

            user_virt.x += normalizedDirection.x * walk_speed;
            user_virt.y += normalizedDirection.y * walk_speed;
        } else {
            // Move to the target POI
            user_virt = { ...targetPOI };
            console.log(`Arrived at POI: ${JSON.stringify(targetPOI)}`);
            is_rotating = true; // Start rotating towards the next POI
            poi_index++;
            if (poi_index < poi.length) {
                console.log(`Now rotating towards next POI: ${JSON.stringify(this.pois[this.currentPOIIndex])}`);
            }
        }
    }
}

ws.onopen = () => {
    console.log('WebSocket connection opened');

    // Send simulation start message and setup info
    sendStartMsg();
};

ws.onmessage = (event) => {
    msg = JSON.parse(event.data);

    switch (msg.type) {
        case "start":
            // Start simulation, send first frame
            sendRunMsg();
            break;

        case "running":
            // Draw user virtual position for this frame
            if (log_virt.push({ x: user_virt.x, y: user_virt.y }) > MAX_PATH_LEN)
                log_virt.shift();  // Update virtual path
            drawVirt();

            // Receive user physical position for this frame
            user_phys = { x: msg.user_x, y: msg.user_y, angle: msg.user_direction }
            if (log_phys.push({ x: user_phys.x, y: user_phys.y }) > MAX_PATH_LEN)
                log_phys.shift();  // Update physical path
            drawPhys();

            // New user virtual position for next frame
            if (!walk()) {
                // Finish simulation
                sendEndMsg();
                break;
            }

            // Send next frame
            sendRunMsg();
            break;

        case "end":
            // end simulation
            ws.close(1, "End of simulation");
            break;
    }

};

ws.onclose = () => {
    console.log('WebSocket connection closed');
};