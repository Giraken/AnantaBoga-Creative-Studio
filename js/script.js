const nav = document.querySelector('.nav-links');
const openNavBtn = document.querySelector('#nav-toggle-open');
const closeNavBtn = document.querySelector('#nav-toggle-close');

const openNav = () => {
    nav.style.display = 'flex';
    openNavBtn.style.display = 'none';
    closeNavBtn.style.display = 'inline-block';
}

openNavBtn.addEventListener('click', openNav);

const closeNav = () => {
    nav.style.display = 'none';
    openNavBtn.style.display = 'inline-block';
    closeNavBtn.style.display = 'none';
}

closeNavBtn.addEventListener('click', closeNav);

nav.querySelector('li a').forEach(navLink => {
    navLink.addEventListener('click', closeNav);
})

// const toggleBtn = document.querySelector('.toggle_btn')
// const toggleBtnIcon = document.querySelector('.toggle_btn i')
// const nav = document.querySelector('.nav_links')

// toggleBtn.onClick = function () {
//     nav.classList.toggle('open')
//     const isOpen = nav.classList.querySelector('open')

//     toggleBtnIcon.classList = isOpen
//         ? 'bx bx-x'
//         : 'bx bx-menu'
// }