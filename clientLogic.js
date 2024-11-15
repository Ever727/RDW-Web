MIN_CUR_GAIN_R = 750;

function mapf_calc_f(width, height, pos){
    const gamma = 2.5;
    const x_f = width * (Math.pow(pos[0], -gamma) - Math.pow(width - pos[0], -gamma));
    const y_f = height * (Math.pow(pos[1], -gamma) - Math.pow(height - pos[1], -gamma));
    return [x_f, y_f];
}

function calc_gain(user, physical_space, delta) {
    const [x_f, y_f] = mapf_calc_f(physical_space.width, physical_space.height, [user.x, user.y]);
    const mapf_angle = Math.atan2(y_f, x_f);
    const rot_angle = (mapf_angle - user.direction) % (2 * Math.PI);
    let rot_dir = 0;
    if (rot_angle > Math.PI) {
        rot_dir = -1;
    } else {
        rot_dir = 1;
    }
    const trans_gain = 1;
    const rot_gain = 1;
    const cur_gain = MIN_CUR_GAIN_R;
    return { trans_gain, rot_gain, cur_gain, rot_dir };
}

function update_user(user, physical_space, delta) {
    const { trans_gain, rot_gain, cur_gain, rot_dir } = calc_gain(user, physical_space, delta);
    const new_user = calc_move_with_gain(user, trans_gain, rot_gain, cur_gain, rot_dir, delta);
    if (physical_space.in_obstacle(new_user.x, new_user.y)) {
        return [update_reset(user, physical_space, delta), true];
    }
    return [new_user, false];
}

function update_reset(user, physical_space, delta) {
    const [x_f, y_f] = mapf_calc_f(physical_space.width, physical_space.height, [user.x, user.y]);
    const mapf_angle = Math.atan2(y_f, x_f);
    user.direction = mapf_angle % (2 * Math.PI);
    return user;
}