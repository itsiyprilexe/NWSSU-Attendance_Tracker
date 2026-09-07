export type Department = {
  code: string;
  name: string;
  logo: any;
};

export const DEPARTMENTS: Department[] = [
  { code: 'CAT', name: 'College of Agriculture and Technology', logo: require('../assets/images/departments/cat-removebg-preview.png') },
  { code: 'CCIS', name: 'College of Computing and Information Sciences', logo: require('../assets/images/departments/ccis-removebg-preview.png') },
  { code: 'CCJS', name: 'College of Criminal Justice Studies', logo: require('../assets/images/departments/ccjs-removebg-preview.png') },
  { code: 'CEA', name: 'College of Engineering and Architecture', logo: require('../assets/images/departments/cea-removebg-preview.png') },
  { code: 'COED', name: 'College of Education', logo: require('../assets/images/departments/coed-removebg-preview.png') },
  { code: 'COM', name: 'College of Management', logo: require('../assets/images/departments/com-removebg-preview.png') },
  { code: 'CON', name: 'College of Nursing', logo: require('../assets/images/departments/con-removebg-preview.png') },
];
