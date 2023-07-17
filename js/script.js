// const nav = document.querySelector('.nav-links');
// const openNavBtn = document.querySelector('#nav-toggle-open');
// const closeNavBtn = document.querySelector('#nav-toggle-close');

// const openNav = () => {
//     nav.style.display = 'flex';
//     openNavBtn.style.display = 'none';
//     closeNavBtn.style.display = 'inline-block';
// }

// openNavBtn.addEventListener('click', openNav);

// const closeNav = () => {
//     nav.style.display = 'none';
//     openNavBtn.style.display = 'inline-block';
//     closeNavBtn.style.display = 'none';
// }

// closeNavBtn.addEventListener('click', closeNav);

// nav.querySelector('li a').forEach(navLink => {
//     navLink.addEventListener('click', closeNav);
// })

const toggleBtn = document.querySelector('.nav-toggle-btn');
const toggleBtnIcon = document.querySelector('.nav-toggle-btn i');
const dropDownMenu = document.querySelector('.dropdown-menu');

toggleBtn.onclick = function () {
    dropDownMenu.classList.toggle('open');
    const isOpen = dropDownMenu.classList.contains('open')

    toggleBtnIcon.classList = isOpen
        ? 'fa-solid fa-xmark'
        : 'fa-solid fa-bars'
}